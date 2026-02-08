
import 'dotenv/config';
import { createPublicClient, createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk"
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import axios from 'axios';

// --- Configuration ---
const AGENT_NAME = "test-agent-v2";
const AGENT_DESCRIPTION = "Autonomous Agent (Smart Account V2 - Verified)";
const AGENT_IMAGE = "https://example.com/agent.png";
const A2A_ENDPOINT = "http://localhost:3000/.well-known/agent-card.json";
const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const PROJECT_ID = process.env.ZERODEV_PROJECT_ID;
const RPC_URL = process.env.RPC_URL;
const PINATA_JWT = process.env.PINATA_JWT;

if (!PROJECT_ID || !RPC_URL || !PINATA_JWT) throw new Error("Missing env vars");

const ZERODEV_RPC = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`;

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
            { internalType: "uint256", name: "agentId", type: "uint256" },
            { internalType: "address", name: "newWallet", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
            { internalType: "bytes", name: "signature", type: "bytes" }
        ],
        name: "setAgentWallet",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
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
    }
] as const;

async function uploadToPinata(metadata: any): Promise<string> {
    try {
        const response = await axios.post(
            `https://api.pinata.cloud/pinning/pinJSONToIPFS`,
            {
                pinataContent: metadata,
                pinataMetadata: { name: `${AGENT_NAME}-metadata.json` }
            },
            {
                headers: { Authorization: `Bearer ${PINATA_JWT}`, 'Content-Type': 'application/json' }
            }
        );
        return `ipfs://${response.data.IpfsHash}`;
    } catch (error: any) {
        throw new Error(`Pinata upload failed: ${error.message}`);
    }
}

async function main() {
    console.log("🚀 Starting Full Agent Setup (The Correct Way)...");

    // 1. Setup Wrapper Clients
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing PRIVATE_KEY");
    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`);

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

    console.log("🔑 Signer (EOA):", account.address);

    // 2. Setup Controlled Smart Account (Deterministic)
    const entryPoint = getEntryPoint("0.7");
    const kernelVersion = KERNEL_V3_1;
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: account,
        entryPoint,
        kernelVersion
    });
    const kernelAccount = await createKernelAccount(publicClient, {
        plugins: { sudo: ecdsaValidator },
        entryPoint,
        kernelVersion
    });
    // We don't deploy it yet, but we know its address
    const smartAccountAddress = kernelAccount.address;
    console.log("🏛️  Smart Account (Controlled):", smartAccountAddress);

    // 3. Upload Metadata
    console.log("☁️  Uploading Metadata...");
    const metadata = {
        name: AGENT_NAME,
        description: AGENT_DESCRIPTION,
        image: AGENT_IMAGE,
        external_url: "https://agent0.xyz",
        attributes: [{ trait_type: "A2A Endpoint", value: A2A_ENDPOINT }]
    };
    const agentURI = await uploadToPinata(metadata);
    console.log("Planner URI:", agentURI);

    // 4. Register Agent (EOA becomes Owner)
    console.log("📝 Registering via EOA...");
    const { request: regRequest } = await publicClient.simulateContract({
        address: REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [agentURI],
        account
    });
    const regHash = await walletClient.writeContract(regRequest);
    console.log("Tx Sent:", regHash);

    console.log("⏳ Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: regHash });

    const logs = await publicClient.getContractEvents({
        address: REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        eventName: 'Registered',
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
    });
    const agentId = logs[0].args.agentId!;
    console.log(`✅ Registered! New Agent ID: ${agentId}`);

    // 5. Set Agent Wallet to Smart Account
    console.log("🔄 Setting Agent Wallet to Smart Account...");

    // Use a very short deadline (2 mins) to satisfy potential strict checks
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 120);
    console.log("Using Deadline:", deadline);

    // Domain must match what the CONTRACT expects for signatures.
    // Inspect said "AgentIdentity", but signature failed.
    // Let's try the standard "ERC8004IdentityRegistry" just in case.
    const domain = {
        name: 'ERC8004IdentityRegistry',
        version: '1',
        chainId: 11155111,
        verifyingContract: REGISTRY_ADDRESS,
    } as const;

    const types = {
        AgentWallet: [
            { name: 'agentId', type: 'uint256' },
            { name: 'newWallet', type: 'address' },
            { name: 'deadline', type: 'uint256' }
        ]
    } as const;

    const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: 'AgentWallet',
        message: {
            agentId,
            newWallet: smartAccountAddress,
            deadline
        }
    });

    const hash = await walletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentWallet',
        args: [agentId, smartAccountAddress, deadline, signature]
    });
    console.log("Set Wallet Tx:", hash);
    await publicClient.waitForTransactionReceipt({ hash });

    console.log("--------------------------------------------------");
    console.log("🎉 SUCCESS! Final State:");
    console.log(`🆔 Agent ID: ${agentId}`);
    console.log(`👑 Owner (NFT): ${account.address} (You)`);
    console.log(`💼 Wallet:      ${smartAccountAddress} (Smart Account)`);
    console.log("--------------------------------------------------");
}

main().catch(console.error);
