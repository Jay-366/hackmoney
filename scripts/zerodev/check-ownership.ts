import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';

// Configuration
const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const SMART_ACCOUNT = "0x757377899a826CfC4272823eb2A2f89268bf9545";

async function main() {
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http("https://rpc.zerodev.app/api/v3/38a6a1ca-bf82-49f2-b689-552da25215bd/chain/11155111")
    });

    console.log(`🔍 Checking ownership for Smart Account: ${SMART_ACCOUNT}`);

    // 1. Find Transfer events TO the Smart Account
    const logs = await publicClient.getLogs({
        address: REGISTRY_ADDRESS,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
        args: {
            to: SMART_ACCOUNT
        },
        fromBlock: await publicClient.getBlockNumber() - 10000n
    });

    if (logs.length === 0) {
        console.log("❌ No Identity transferred to this Smart Account found.");
        return;
    }

    // Get the latest token ID
    const latestLog = logs[logs.length - 1];
    const agentId = latestLog.args.tokenId;
    console.log(`✅ Found Agent Identity! Agent ID: ${agentId}`);

    // 2. Verify current owner
    const owner = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: [parseAbiItem('function ownerOf(uint256) view returns (address)')],
        functionName: 'ownerOf',
        args: [agentId]
    });
    console.log(`👑 Current Owner on-chain: ${owner}`);

    if (owner?.toLowerCase() === SMART_ACCOUNT.toLowerCase()) {
        console.log("🎉 SUCCESS: Smart Account OWNS the Agent Identity.");
    } else {
        console.error("⚠️ WARNING: Smart Account is NOT the current owner.");
    }

    // 3. Check Agent Wallet (Optional, just for info)
    const wallet = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: [parseAbiItem('function getAgentWallet(uint256) view returns (address)')],
        functionName: 'getAgentWallet',
        args: [agentId]
    });
    console.log(`💼 Current Agent Wallet: ${wallet}`);
}

main().catch(console.error);
