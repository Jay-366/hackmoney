
import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const HOOK = "0x94C085DA9162604d9C964886605F0f7163Ac40c0";

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    console.log("Checking code at:", HOOK);
    const code = await provider.getCode(HOOK);
    console.log("Code length:", code.length);
    if (code === "0x") {
        console.log("❌ NO CODE at hook address!");
    } else {
        console.log("✅ Code found.");
    }
}

main().catch(console.error);
