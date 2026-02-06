/**
 * LLM Agent
 * 
 * This file contains the AI logic for your agent.
 * By default, it uses OpenAI's GPT-4o-mini model.
 * 
 * To customize:
 * - Change the model in chat() (e.g., 'gpt-4o', 'gpt-3.5-turbo')
 * - Modify the system prompt in generateResponse()
 * - Add custom logic, tools, or RAG capabilities
 * 
 * To use a different LLM provider:
 * - Replace the OpenAI import with your preferred SDK
 * - Update the chat() function accordingly
 */

import OpenAI from 'openai';
import { createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk"
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants"
import { deserializePermissionAccount } from "@zerodev/permissions"
import { toECDSASigner } from "@zerodev/permissions/signers"
import { http, createPublicClient, zeroAddress, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import 'dotenv/config'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- ZeroDev Setup ---
const PROJECT_ID = process.env.ZERODEV_PROJECT_ID
const RPC_URL = process.env.RPC_URL || "https://sepolia.drpc.org"
const ZERODEV_RPC = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`

// ============================================================================
// Types
// ============================================================================

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Execute a transaction using the Persistent Session Key
 */
async function executeTransaction(args: { to?: string, value?: string }): Promise<string> {
  try {
    const sessionKeyPrivate = process.env.SESSION_KEY_PRIVATE
    const approval = process.env.SESSION_APPROVAL
    const toAddress = args.to || zeroAddress
    const valueAmount = args.value ? BigInt(parseEther(args.value).toString()) : BigInt(0)

    if (!sessionKeyPrivate || !approval) {
      return "Error: Missing Session Key or Approval string. Please configure .env."
    }

    const publicClient = createPublicClient({
      transport: http(RPC_URL),
      chain: sepolia
    })
    const zerodevPaymaster = createZeroDevPaymasterClient({
      chain: sepolia,
      transport: http(ZERODEV_RPC),
    })

    // 1. Restore the Agent's Account from the Approval String
    const sessionKeySigner = await toECDSASigner({
      signer: privateKeyToAccount(sessionKeyPrivate as `0x${string}`),
    })
    const entryPoint = getEntryPoint("0.7")

    const agentAccount = await deserializePermissionAccount(
      publicClient,
      entryPoint,
      KERNEL_V3_1,
      approval,
      sessionKeySigner
    )

    // 2. Create Client
    const agentClient = createKernelAccountClient({
      account: agentAccount,
      chain: sepolia,
      bundlerTransport: http(ZERODEV_RPC),
      client: publicClient,
      paymaster: {
        getPaymasterData(userOperation) {
          return zerodevPaymaster.sponsorUserOperation({ userOperation })
        }
      },
    })

    console.log(`🤖 Agent executing transaction...`)
    console.log(`   From: ${agentAccount.address}`)
    console.log(`   To: ${toAddress}`)
    console.log(`   Value: ${valueAmount.toString()} wei`)

    // 3. Send Transaction
    const calls = [{
      to: toAddress as `0x${string}`,
      value: valueAmount,
      data: "0x",
    }];
    const generatedCallData = await agentClient.account.encodeCalls(calls);
    // console.log("🐛 DEBUG CallData:", generatedCallData);

    const userOpHash = await agentClient.sendUserOperation({
      callData: generatedCallData,
    })

    console.log(`✅ UserOp Hash: ${userOpHash}`)

    // Wait for receipt
    const receipt = await agentClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    return `Transaction Successful! Hash: ${receipt.receipt.transactionHash} (View on Etherscan: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash})`

  } catch (e: any) {
    console.error("Exec Error:", e)
    const fs = require('fs');
    fs.writeFileSync('execution-error.log', JSON.stringify(e, null, 2));
    return `Transaction Failed: ${e.message}`
  }
}


export async function chat(messages: any[]): Promise<string> {
  const tools = [
    {
      type: "function",
      function: {
        name: "execute_onchain_transaction",
        description: "Execute a transaction on the blockchain using the agent's wallet. Use this to transfer ETH or interact with contracts. Default 'to' is zeroAddress, default 'value' is 0.",
        parameters: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "The recipient wallet address (must be a valid Ethereum address starting with 0x).",
            },
            value: {
              type: "string",
              description: "The amount of ETH to send (e.g., '0.0001').",
            }
          },
          required: [],
        },
      },
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    tools: tools as any,
    tool_choice: "auto",
  });

  const message = response.choices[0]?.message;

  // Handle Tool Calls
  if (message?.tool_calls && message.tool_calls.length > 0) {
    console.log("🛠️ Agent decided to call tool:", message.tool_calls[0].function.name)

    const toolCall = message.tool_calls[0];
    if (toolCall.function.name === "execute_onchain_transaction") {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await executeTransaction(args);

      // Feed result back to LLM
      const newMessages = [
        ...messages,
        message,
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: result
        }
      ];
      return chat(newMessages);
    }
  }

  return message?.content ?? 'No response';
}

export async function generateResponse(userMessage: string, history: AgentMessage[] = []): Promise<string> {
  const systemPrompt = {
    role: 'system',
    content: 'You are an Autonomous AI Agent with a Blockchain Wallet. You can execute transactions when asked. You are powered by ZeroDev Session Keys.',
  };

  const messages = [
    systemPrompt,
    ...history,
    { role: 'user', content: userMessage },
  ];

  return chat(messages);
}
