import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const POSITION_MANAGER = "0x429e2c08a953f8ae4d1b092e661f4340794fcec2";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0";
const FEE = 1000;
const TICK_SPACING = 60;

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

const PERMIT2_ABI = [
    "function approve(address token, address spender, uint160 amount, uint48 expiration) external"
];

// Simplified PositionManager ABI focusing on modifyLiquidities
const POSM_ABI = [
    "function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable"
];

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("Using Wallet:", wallet.address);

    // Sort tokens
    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);

    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: HOOK
    };

    // Amounts to add (100 ETH + 100 USDC)
    const amount0Desired = token0 === ETH.toLowerCase()
        ? ethers.utils.parseUnits("100", 18)
        : ethers.utils.parseUnits("100", 6);

    const amount1Desired = token1 === USDC.toLowerCase()
        ? ethers.utils.parseUnits("100", 6)
        : ethers.utils.parseUnits("100", 18);

    console.log(`\n💰 Adding Liquidity:`);
    console.log(`Amount0: ${ethers.utils.formatUnits(amount0Desired, token0 === ETH.toLowerCase() ? 18 : 6)}`);
    console.log(`Amount1: ${ethers.utils.formatUnits(amount1Desired, token1 === USDC.toLowerCase() ? 6 : 18)}`);

    // --- Step 1: Approve Permit2 ---
    console.log("\n📝 Step 1: Approving Permit2...");
    const t0 = new ethers.Contract(token0, ERC20_ABI, wallet);
    const t1 = new ethers.Contract(token1, ERC20_ABI, wallet);

    const maxUint256 = ethers.constants.MaxUint256;

    let tx = await t0.approve(PERMIT2, maxUint256);
    await tx.wait();
    console.log("✅ Token0 approved to Permit2");

    tx = await t1.approve(PERMIT2, maxUint256);
    await tx.wait();
    console.log("✅ Token1 approved to Permit2");

    // --- Step 2: Approve PositionManager via Permit2 ---
    console.log("\n📝 Step 2: Approving PositionManager via Permit2...");
    const permit2 = new ethers.Contract(PERMIT2, PERMIT2_ABI, wallet);
    const maxUint160 = ethers.BigNumber.from("1461501637330902918203684832716283019655932542975");
    const expiration = 2000000000000; // Far future

    tx = await permit2.approve(token0, POSITION_MANAGER, maxUint160, expiration);
    await tx.wait();
    console.log("✅ Token0 approved to PositionManager");

    tx = await permit2.approve(token1, POSITION_MANAGER, maxUint160, expiration);
    await tx.wait();
    console.log("✅ Token1 approved to PositionManager");

    // --- Step 3: Build modifyLiquidities calldata ---
    console.log("\n📝 Step 3: Building modifyLiquidities calldata...");

    // For full range liquidity:
    // tickLower = MIN_TICK (aligned to tickSpacing)
    // tickUpper = MAX_TICK (aligned to tickSpacing)
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;

    // Align ticks to tick spacing
    const tickLower = Math.floor(MIN_TICK / TICK_SPACING) * TICK_SPACING;
    const tickUpper = Math.floor(MAX_TICK / TICK_SPACING) * TICK_SPACING;

    console.log(`Tick Range: [${tickLower}, ${tickUpper}]`);

    // Encode Actions: MINT(1), SETTLE(4), SETTLE(4), TAKE(5), TAKE(5), CLOSE_CURRENCY(2), CLOSE_CURRENCY(2)
    // Simplified: We'll use the pattern from the UI

    // Action codes (from V4 SDK):
    const INCREASE_LIQUIDITY = "0x00";
    const SETTLE_PAIR = "0x04";
    const TAKE_PAIR = "0x05";
    const CLOSE_CURRENCY = "0x02";
    const CLEAR_OR_TAKE = "0x06";
    const SWEEP = "0x07";

    // Build the actions byte string
    // For adding liquidity: INCREASE_LIQUIDITY + SETTLE_PAIR + TAKE_PAIR + CLOSE (x2)
    const actions = INCREASE_LIQUIDITY + SETTLE_PAIR.slice(2) + TAKE_PAIR.slice(2) + CLOSE_CURRENCY.slice(2) + CLOSE_CURRENCY.slice(2);

    // Encode params for each action
    const abiCoder = new ethers.utils.AbiCoder();

    // INCREASE_LIQUIDITY params: (poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, hookData)
    // We'll set liquidity to a large number and let it calculate based on amount0Max/amount1Max
    const liquidityDesired = ethers.utils.parseUnits("1000000", 18); // Large number

    const increaseParams = abiCoder.encode(
        ["tuple(address,address,uint24,int24,address)", "int24", "int24", "uint256", "uint128", "uint128", "bytes"],
        [
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
            tickLower,
            tickUpper,
            liquidityDesired,
            amount0Desired,
            amount1Desired,
            "0x" // empty hookData
        ]
    );

    // SETTLE_PAIR params: (currency0, currency1)
    const settlePairParams = abiCoder.encode(
        ["address", "address"],
        [poolKey.currency0, poolKey.currency1]
    );

    // TAKE_PAIR params: (currency0, currency1, to)
    const takePairParams = abiCoder.encode(
        ["address", "address", "address"],
        [poolKey.currency0, poolKey.currency1, wallet.address]
    );

    // CLOSE_CURRENCY params: (currency)
    const closeCurrency0Params = abiCoder.encode(["address"], [poolKey.currency0]);
    const closeCurrency1Params = abiCoder.encode(["address"], [poolKey.currency1]);

    // Combine all params
    const allParams = [
        increaseParams,
        settlePairParams,
        takePairParams,
        closeCurrency0Params,
        closeCurrency1Params
    ];

    // Encode the full unlockData
    const unlockData = abiCoder.encode(
        ["bytes", "bytes[]"],
        [actions, allParams]
    );

    console.log("✅ Calldata built");

    // --- Step 4: Call modifyLiquidities ---
    console.log("\n📝 Step 4: Calling modifyLiquidities...");

    const posm = new ethers.Contract(POSITION_MANAGER, POSM_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    try {
        tx = await posm.modifyLiquidities(unlockData, deadline, {
            value: 0, // Not using native ETH
            gasLimit: 5000000
        });

        console.log("✅ Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Liquidity added! Block:", receipt.blockNumber);
        console.log("\n🎉 SUCCESS! Now run:");
        console.log("   bun scripts/agentSwap.ts");
    } catch (error: any) {
        console.error("❌ Error adding liquidity:", error.message);
        console.log("\n💡 The modifyLiquidities encoding is complex.");
        console.log("Use the UI instead:");
        console.log("1. Go to /positions/create");
        console.log("2. Set Fee = 500");
        console.log("3. Check Full Range");
        console.log("4. Enter 100 for both amounts");
        console.log("5. Click Approvals & Mint");
    }
}

main().catch(console.error);
