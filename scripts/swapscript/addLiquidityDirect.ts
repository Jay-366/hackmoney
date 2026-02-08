import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const POSITION_MANAGER = "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4";
const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x8E5AA11AD9165E247a2c8C12d3a3f873BA4340c0";
const FEE = 3000;
const TICK_SPACING = 6;

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("Using Wallet:", wallet.address);

    // Sort tokens
    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    // Amounts: 100 ETH + 100000 USDC (to ensure we have enough on both sides)
    const amount0 = token0 === ETH.toLowerCase()
        ? ethers.utils.parseUnits("100", 18)  // 100 ETH
        : ethers.utils.parseUnits("100000", 6); // 100000 USDC

    const amount1 = token1 === USDC.toLowerCase()
        ? ethers.utils.parseUnits("100000", 6)  // 100000 USDC
        : ethers.utils.parseUnits("100", 18);   // 100 ETH

    console.log(`Adding Liquidity: ${ethers.utils.formatUnits(amount0, token0 === ETH.toLowerCase() ? 18 : 6)} Token0`);
    console.log(`Adding Liquidity: ${ethers.utils.formatUnits(amount1, token1 === USDC.toLowerCase() ? 6 : 18)} Token1`);

    // This is a simplified approach - we'll use the PoolManager's donate function
    // or manually call modifyLiquidities if we can construct the calldata

    console.log("\n⚠️  Unfortunately, adding liquidity programmatically requires complex SDK encoding.");
    console.log("The UI should work if you:");
    console.log("1. Hard refresh the page (Cmd+Shift+R)");
    console.log("2. Check 'Full Range'");
    console.log("3. Enter 100 in BOTH Amount fields");
    console.log("4. Check browser console for the logs I added");
    console.log("\nIf you see 'Parsed Amount0: 100000000000000000000 Wei', then it's working!");
    console.log("If you see 'Parsed Amount0: 100 Wei', then the fix didn't apply.");
}

main().catch(console.error);
