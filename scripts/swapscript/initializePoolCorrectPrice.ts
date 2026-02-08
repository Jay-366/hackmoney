import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
const ETH = "0x209A45E3242a2985bA5701e07615B441FF2593c9";
const USDC = "0xAf6C3A632806ED83155F9F582D1C63aC31d1d435";
const HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0";
const FEE = 10000; // Match UI (0.3% -> 5000 is 0.5% actually? Wait. 3000 is 0.3%. 5000 is 0.5%. UI says 5000)
const TICK_SPACING = 40; // Match UI

const POOL_MANAGER_ABI = [  
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "currency0", "type": "address" },
                    { "internalType": "address", "name": "currency1", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
                    { "internalType": "address", "name": "hooks", "type": "address" }
                ],
                "internalType": "struct PoolKey",
                "name": "key",
                "type": "tuple"
            },
            { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" }
        ],
        "name": "initialize",
        "outputs": [{ "internalType": "int24", "name": "tick", "type": "int24" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("Using Wallet:", wallet.address);

    // Sort tokens
    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: HOOK
    };

    // Calculate correct sqrtPriceX96 for 1 ETH = 1 USDC (in human terms)
    // token0 = ETH (18 decimals), token1 = USDC (6 decimals)
    // We want: 1 ETH (10^18 wei) = 1 USDC (10^6 wei)
    // Price = token1/token0 = 10^6 / 10^18 = 10^-12
    // sqrtPrice = sqrt(10^-12) = 10^-6
    // sqrtPriceX96 = 10^-6 * 2^96 = 2^96 / 10^6

    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceX96 = Q96.div(1000000); // 2^96 / 10^6

    console.log("\n🔄 Initializing NEW pool with CORRECT price...");
    console.log(`Token0: ${token0} (${token0 === ETH.toLowerCase() ? 'ETH' : 'USDC'})`);
    console.log(`Token1: ${token1} (${token1 === USDC.toLowerCase() ? 'USDC' : 'ETH'})`);
    console.log(`Fee: ${FEE} (0.05%)`);
    console.log(`Price (1:1 in human terms): 10^-12 in wei terms`);
    console.log(`sqrtPriceX96: ${sqrtPriceX96}`);

    const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);

    try {
        const tx = await poolManager.initialize(poolKey, sqrtPriceX96, {
            gasLimit: 1000000
        });
        console.log("\n✅ Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Pool initialized! Block:", receipt.blockNumber);
        console.log("\n🎉 SUCCESS! Now:");
        console.log("1. Go to UI and set Fee = 500");
        console.log("2. Add liquidity with Full Range");
        console.log("3. Update agentSwap.ts to use FEE = 500");
    } catch (error: any) {
        console.error("❌ Error:", error.message);
        if (error.message?.includes("PoolAlreadyInitialized") || error.message?.includes("AI")) {
            console.log("\n⚠️  Pool with fee=500 already exists.");
            console.log("Try using fee=10000 (1%) instead, or use the existing fee=500 pool.");
        }
    }
}

main().catch(console.error);
