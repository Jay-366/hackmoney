import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';
import axios from 'axios';

const AGENT_ID = 945;
const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

async function main() {
    console.log(`🔍 Fetching Metadata for Agent ID: ${AGENT_ID}...`);

    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http("https://sepolia.drpc.org") // Or use process.env.RPC_URL
    });

    // 1. Get Agent URI from Contract
    const agentURI = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: [parseAbiItem('function tokenURI(uint256) view returns (string)')], // ERC-721 tokenURI
        functionName: 'tokenURI',
        args: [BigInt(AGENT_ID)]
    }) as string;

    console.log(`🔗 On-Chain URI: ${agentURI}`);

    if (!agentURI) {
        console.error("❌ No URI found!");
        return;
    }

    // 2. Convert IPFS to HTTP
    const gatewayUrl = agentURI.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    console.log(`🌍 Gateway URL: ${gatewayUrl}`);

    // 3. Fetch Metadata
    try {
        const response = await axios.get(gatewayUrl);
        const metadata = response.data;

        console.log("\n📜 --- Agent Metadata ---");
        console.log(`Name: ${metadata.name}`);
        console.log(`Description: ${metadata.description}`);
        console.log(`Image: ${metadata.image}`);

        if (metadata.services && metadata.services.length > 0) {
            console.log("\n🛠️ --- Services ---");
            metadata.services.forEach((service: any, index: number) => {
                console.log(`[${index + 1}] Type: ${service.name}`);
                console.log(`    Endpoint: ${service.endpoint}`);
                console.log(`    Version: ${service.version || "N/A"}`);

                if (service.name === "ENS") {
                    console.log(`    ✅ ENS VERIFIED: ${service.endpoint}`);
                }
            });
        } else {
            console.log("\n⚠️ No 'services' found in metadata.");
        }

        console.log("\n-------------------------");

    } catch (e: any) {
        console.error("❌ Failed to fetch IPFS data:", e.message);
    }
}

main().catch(console.error);
