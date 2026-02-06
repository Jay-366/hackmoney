import 'dotenv/config';
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import axios from 'axios';

// --- Configuration ---
const AGENT_NAME = "test-agent";
const AGENT_DESCRIPTION = "Autonomous Agent (Smart Account)";
const AGENT_IMAGE = "https://example.com/agent.png";
const A2A_ENDPOINT = "http://localhost:3000/.well-known/agent-card.json";
const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const SMART_ACCOUNT_ADDRESS = "0x757377899a826CfC4272823eb2A2f89268bf9545"; // From logs
const PINATA_JWT = process.env.PINATA_JWT;

const IDENTITY_REGISTRY_ABI = [
    {
        inputs: [{ internalType: 'string', name: 'agentURI', type: 'string' }],
        name: 'register',
        outputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'from', type: 'address' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'tokenId', type: 'uint256' }
        ],
        name: 'safeTransferFrom',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'uint256', name: 'agentId', type: 'uint256' },
            { indexed: false, internalType: 'string', name: 'agentURI', type: 'string' },
            { indexed: true, internalType: 'address', name: 'owner', type: 'address' }
        ],
        name: 'Registered',
        type: 'event'
    },
    {
        inputs: [
            { internalType: "uint256", name: "agentId", type: "uint256" },
            { internalType: "address", name: "newWallet", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
            { internalType: "bytes", name: "signature", type: "bytes" }
        ],
        name: "setAgentWallet",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
];

async function uploadToPinata(metadata: any): Promise<string> {
    if (!PINATA_JWT) throw new Error("Missing PINATA_JWT");
    try {
        const response = await axios.post(
            `https://api.pinata.cloud/pinning/pinJSONToIPFS`,
            {
                pinataContent: metadata,
                pinataMetadata: { name: `${AGENT_NAME}-metadata.json` }
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
    console.log("🚀 Starting EOA Registration & Transfer...");

    // 1. Setup Clients
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing PRIVATE_KEY");

    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`);
    const client = createWalletClient({ account, chain: sepolia, transport: http(process.env.RPC_URL) });
    const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL) });

    console.log("🔑 Signer:", account.address);
    // Check ETH balance
    const bal = await publicClient.getBalance({ address: account.address });
    console.log("💰 Balance:", bal.toString());
    if (bal === 0n) throw new Error("EOA has 0 ETH. Needed for gas.");

    // 2. Upload Metadata
    console.log("☁️ Uploading Metadata...");
    const metadata = {
        name: AGENT_NAME,
        description: AGENT_DESCRIPTION,
        image: AGENT_IMAGE,
        external_url: "https://agent0.xyz",
        attributes: [{ trait_type: "A2A Endpoint", value: A2A_ENDPOINT }]
    };
    const agentURI = await uploadToPinata(metadata);
    console.log("Planner URI:", agentURI);

    // 3. Register (EOA)
    console.log("📝 Registering via EOA...");
    const { request: regRequest } = await publicClient.simulateContract({
        address: REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [agentURI],
        account
    });
    const regHash = await client.writeContract(regRequest);
    console.log("Tx Sent:", regHash);

    console.log("⏳ Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: regHash });

    // Parse Event to get Agent ID
    const logs = await publicClient.getContractEvents({
        address: REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        eventName: 'Registered',
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
    });

    const agentId = logs[0].args.agentId;
    console.log(`✅ Registered! Agent ID: ${agentId}`);

    // 4. Transfer to Smart Account
    console.log(`🚚 Transferring ownership to ${SMART_ACCOUNT_ADDRESS}...`);
    const { request: transferRequest } = await publicClient.simulateContract({
        address: REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'safeTransferFrom',
        args: [account.address, SMART_ACCOUNT_ADDRESS, agentId],
        account
    });
    const transferHash = await client.writeContract(transferRequest);
    console.log("Transfer Tx:", transferHash);
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    console.log("✅ Ownership Transferred!");

    // 5. Set Agent Wallet (Optional? If owned by Smart Account, it defaults to Smart Account? No, getAgentWallet is separate)
    // Actually, getting the wallet uses separate logic.
    // If I want to set the wallet, I need to call setAgentWallet.
    // setAgentWallet requires a signature from the NEW wallet (Smart Account).
    // The Smart Account is a contract. It supports EIP-1271?
    // The Registry supports EIP-712 signatures.
    // Generating a signature *from* a Smart Account for EIP-712 is tricky/impossible for `setAgentWallet` if it expects ECDSA by default?
    // Wait, the ABI says `bytes signature`.
    // If the new wallet is a contract, does the registry check EIP-1271?
    // I need to check `agent0-sdk` logic or contract code.
    // `signerToEcdsaValidator` creates an ECDSA owner for the Smart Account.
    // But the `setAgentWallet` call is on the Registry.

    // For now, let's just Transfer Ownership. 
    // If Smart Account owns the Identity, it can call `setAgentWallet` later (via UserOp) more easily if needed,
    // (though UserOp is crashing us right now).
    // Let's assume Transferring Identity is the main goal "Agent Identity on-chain is the Smart Account".

    console.log("🎉 Done! Smart Account now owns the Agent.");
}

main().catch(console.error);
