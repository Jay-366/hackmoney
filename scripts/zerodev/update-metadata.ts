import 'dotenv/config';
import { createWalletClient, http, encodeFunctionData, parseAbiItem, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";
import axios from 'axios';

// --- Configuration ---
const AGENT_ID = 945;
const AGENT_NAME = "test-agent";
const AGENT_DESCRIPTION = "Autonomous Agent (Smart Account)";
const AGENT_IMAGE = "https://example.com/agent.png"; // You might want to update this?
const A2A_ENDPOINT = "http://localhost:3000/.well-known/agent-card.json";
const ENS_NAME = "ky-test.eth";
const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const PINATA_JWT = process.env.PINATA_JWT;

async function uploadToPinata(metadata: any): Promise<string> {
    if (!PINATA_JWT) throw new Error("Missing PINATA_JWT");
    try {
        const response = await axios.post(
            `https://api.pinata.cloud/pinning/pinJSONToIPFS`,
            {
                pinataContent: metadata,
                pinataMetadata: { name: `${AGENT_NAME}-metadata-v2.json` }
            },
            {
                headers: {
                    Authorization: `Bearer ${PINATA_JWT}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return `ipfs://${response.data.IpfsHash}`;
    } catch (error: any) {
        throw new Error(`Pinata upload failed: ${error.message}`);
    }
}

async function main() {
    console.log(`🚀 Updating Metadata for Agent ID: ${AGENT_ID}...`);

    try {
        // 1. Setup Client
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("Missing PRIVATE_KEY");

        const owner = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`);
        const publicClient = createPublicClient({ transport: http(process.env.RPC_URL), chain: sepolia });
        const PROJECT_ID = process.env.ZERODEV_PROJECT_ID;
        const ZERODEV_RPC_URL = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`;
        const zerodevPaymaster = createZeroDevPaymasterClient({ chain: sepolia, transport: http(ZERODEV_RPC_URL) });
        const entryPoint = getEntryPoint("0.7");
        const ecdsaValidator = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint, kernelVersion: KERNEL_V3_1 });

        console.log("Creating Kernel Account...");
        const account = await createKernelAccount(publicClient, { plugins: { sudo: ecdsaValidator }, entryPoint, kernelVersion: KERNEL_V3_1 });

        console.log("Creating Kernel Client...");
        const kernelClient = createKernelAccountClient({
            account,
            chain: sepolia,
            bundlerTransport: http(ZERODEV_RPC_URL),
            client: publicClient,
            paymaster: {
                getPaymasterData: async (userOp) => {
                    console.log("💸 Sponsoring UserOp...");
                    try {
                        const pmData = await zerodevPaymaster.sponsorUserOperation({ userOperation: userOp });
                        console.log("💸 Paymaster Data Received:", pmData);
                        return pmData;
                    } catch (e) {
                        console.error("💸 Paymaster Error:", e);
                        throw e;
                    }
                }
            }
        });

        console.log("🤖 Smart Account:", account.address);

        // 2. Prepare NEW Metadata
        const metadata = {
            name: AGENT_NAME,
            description: AGENT_DESCRIPTION,
            image: AGENT_IMAGE,
            external_url: "https://agent0.xyz",
            services: [
                { name: "A2A", endpoint: A2A_ENDPOINT, version: "0.3.0" },
                { name: "ENS", endpoint: ENS_NAME, version: "v1" }
            ],
            attributes: [{ trait_type: "A2A Endpoint", value: A2A_ENDPOINT }]
        };

        console.log("☁️ Uploading New Metadata...");
        const newAgentURI = await uploadToPinata(metadata);
        console.log("New URI:", newAgentURI);

        // 3. Send UserOp
        const callData = encodeFunctionData({
            abi: [parseAbiItem('function setAgentURI(uint256 agentId, string newURI) external')],
            functionName: 'setAgentURI',
            args: [BigInt(AGENT_ID), newAgentURI]
        });

        console.log("⛓️ Sending Update UserOp...");
        const encodedCalls = await account.encodeCalls([{
            to: REGISTRY_ADDRESS,
            value: BigInt(0),
            data: callData
        }]);
        console.log("Encoded Calls:", encodedCalls);

        const userOpHash = await kernelClient.sendUserOperation({
            callData: encodedCalls
        });

        console.log("✅ UserOp Sent! Hash:", userOpHash);

        // Manual Polling
        const BUNDLER_URL = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`;
        console.log("⏳ Polling Bundler for receipt...");

        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const res = await axios.post(BUNDLER_URL, {
                jsonrpc: '2.0', id: 1, method: 'eth_getUserOperationReceipt', params: [userOpHash]
            }).catch(e => ({ data: { error: e.message } }));

            if (res.data?.result) {
                const receipt = res.data.result;
                if (receipt.success) {
                    console.log("🎉 SUCCESS! Metadata Updated.");
                    console.log("Transaction Hash:", receipt.receipt.transactionHash);
                    return;
                } else {
                    console.error("❌ FAILURE! UserOp Reverted.");
                    return;
                }
            }
        }
        console.log("\n⚠️ Timeout polling bundler.");

    } catch (e: any) {
        console.error("Script Error Detailed:", e);
    }
}

main();
