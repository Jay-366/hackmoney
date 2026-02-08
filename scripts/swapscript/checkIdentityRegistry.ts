
import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const REP_REGISTRY = "0x3bb25e47ada8527c264c582f7763b6e5c2a8e2a6"; // Provided by user

const REP_ABI = [
    "function identityRegistry() external view returns (address)"
];

const ID_ABI = [
    "function ownerOf(uint256 agentId) external view returns (address)",
    "function totalSupply() external view returns (uint256)"
];

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const repRegistry = new ethers.Contract(REP_REGISTRY, REP_ABI, provider);

    console.log("Checking Reputation Registry:", REP_REGISTRY);

    try {
        const idRegAddress = await repRegistry.identityRegistry();
        console.log("✅ Linked Identity Registry:", idRegAddress);

        const idRegistry = new ethers.Contract(idRegAddress, ID_ABI, provider);

        // Check if the registry responds to balanceOf (ERC721 standard)
        // Using a random address or the deployer to test read access.
        const testAddr = "0x291F0E5392A772D79150f8be38106Dd65FccA769";
        try {
            const bal = await idRegistry.balanceOf(testAddr);
            console.log(`Balance of ${testAddr}:`, bal.toString());
        } catch (e) {
            console.log("Balance check failed, trying name():");
            try {
                const name = await idRegistry.name();
                console.log("Registry Name:", name);
            } catch (e2) {
                console.log("Name check failed.");
            }
        }

    } catch (e) {
        console.error("❌ Failed to read Identity Registry:", e);
    }
}

main().catch(console.error);
