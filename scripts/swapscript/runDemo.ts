import { ethers } from "ethers";
import { config } from "dotenv";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
let AGENT_KEY = "dac64655d0b78804819c9a29c50038f49eba94619bd348eb3bd4676d2c3b712f";
if (!AGENT_KEY.startsWith("0x")) AGENT_KEY = `0x${AGENT_KEY}`;

const UNIVERSAL_ROUTER = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
const STATE_VIEW = "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
const HOOK = "0x87722c424B5d9C9b9D6113198b38D668C954C0C0";

const ETH = { address: "0x209a45e3242a2985ba5701e07615b441ff2593c9", decimals: 18 };
const USDC = { address: "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435", decimals: 6 };
const FEE = 5000;
const TICK_SPACING = 60;

async function demonstrateSwap(amountEth: string) {
    console.log("\n" + "=".repeat(100));
    console.log(`🎯 DEMONSTRATING SWAP: ${amountEth} ETH`);
    console.log("=".repeat(100));

    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(AGENT_KEY, provider);
    const amountInWei = ethers.utils.parseUnits(amountEth, 18);

    console.log(`\n📝 STEP 1: Swap Parameters`);
    console.log(`   Input Amount: ${amountEth} ETH`);
    console.log(`   Wei Amount: ${amountInWei.toString()}`);
    console.log(`   Sender: ${wallet.address}`);

    // Get pool state
    const isEthToken0 = ETH.address.toLowerCase() < USDC.address.toLowerCase();
    const [token0, token1] = isEthToken0 ? [ETH.address, USDC.address] : [USDC.address, ETH.address];

    const encoded = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [token0, token1, FEE, TICK_SPACING, HOOK]
    );
    const poolId = ethers.utils.keccak256(encoded);

    const stateViewAbi = [
        "function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)",
        "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
    ];
    const stateView = new ethers.Contract(STATE_VIEW, stateViewAbi, provider);

    const liquidity = await stateView.getLiquidity(poolId);
    const slot0 = await stateView.getSlot0(poolId);

    console.log(`\n📊 STEP 2: Pool State (Before Swap)`);
    console.log(`   Pool ID: ${poolId}`);
    console.log(`   Liquidity (L): ${liquidity.toString()}`);
    console.log(`   Current Tick: ${slot0.tick.toString()}`);
    console.log(`   SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);

    // Calculate Rnow components
    const K = ethers.BigNumber.from("100000000000000000000"); // 1e20 from hook

    // Price Impact: I = (amt * 1e18) / (amt + K)
    const priceImpactNum = amountInWei.mul(ethers.BigNumber.from("1000000000000000000"));
    const priceImpactDen = amountInWei.add(K);
    const priceImpactRaw = priceImpactNum.div(priceImpactDen);
    const priceImpact = parseFloat(ethers.utils.formatUnits(priceImpactRaw, 18));

    // Liquidity Stress: S = (amt * 1e18) / L
    const stressNum = amountInWei.mul(ethers.BigNumber.from("1000000000000000000"));
    const stressRaw = stressNum.div(liquidity);
    const liquidityStress = parseFloat(ethers.utils.formatUnits(stressRaw, 18));

    // Rnow = W_I * I + W_S * S
    const W_I = 0.6;
    const W_S = 0.4;
    const rnowCalculated = W_I * priceImpact + W_S * liquidityStress;

    console.log(`\n🧮 STEP 3: Risk Metrics Calculation`);
    console.log(`\n   A. Price Impact (I):`);
    console.log(`      Formula: I = (swapAmount × 1e18) / (swapAmount + K)`);
    console.log(`      K = ${ethers.utils.formatUnits(K, 18)} ETH (constant from hook)`);
    console.log(`      I = (${amountEth} × 1e18) / (${amountEth} + ${ethers.utils.formatUnits(K, 18)})`);
    console.log(`      I = ${ethers.utils.formatUnits(priceImpactNum, 18)} / ${ethers.utils.formatUnits(priceImpactDen, 18)}`);
    console.log(`      I = ${priceImpact.toFixed(8)}`);

    console.log(`\n   B. Liquidity Stress (S):`);
    console.log(`      Formula: S = (swapAmount × 1e18) / poolLiquidity`);
    console.log(`      S = (${amountEth} × 1e18) / ${liquidity.toString()}`);
    console.log(`      S = ${ethers.utils.formatUnits(stressNum, 18)} / ${ethers.utils.formatUnits(liquidity, 0)}`);
    console.log(`      S = ${liquidityStress.toFixed(8)}`);

    console.log(`\n   C. Combined Risk (Rnow):`);
    console.log(`      Formula: Rnow = (W_I × I) + (W_S × S)`);
    console.log(`      W_I = ${W_I} (Price Impact Weight)`);
    console.log(`      W_S = ${W_S} (Liquidity Stress Weight)`);
    console.log(`      Rnow = (${W_I} × ${priceImpact.toFixed(8)}) + (${W_S} × ${liquidityStress.toFixed(8)})`);
    console.log(`      Rnow = ${(W_I * priceImpact).toFixed(8)} + ${(W_S * liquidityStress).toFixed(8)}`);
    console.log(`      Rnow = ${rnowCalculated.toFixed(8)}`);

    // Determine fee tier
    const R_RETAIL_MAX = 0.3;
    const R_ELEV_MAX = 0.7;

    let expectedTier, expectedFee, tierLogic;
    if (rnowCalculated < R_RETAIL_MAX) {
        expectedTier = "RETAIL";
        expectedFee = 3000;
        tierLogic = `Rnow (${rnowCalculated.toFixed(3)}) < R_RETAIL_MAX (${R_RETAIL_MAX})`;
    } else if (rnowCalculated < R_ELEV_MAX) {
        expectedTier = "ELEVATED";
        expectedFee = 6000;
        tierLogic = `R_RETAIL_MAX (${R_RETAIL_MAX}) ≤ Rnow (${rnowCalculated.toFixed(3)}) < R_ELEV_MAX (${R_ELEV_MAX})`;
    } else {
        expectedTier = "TOXIC";
        expectedFee = 15000;
        tierLogic = `Rnow (${rnowCalculated.toFixed(3)}) ≥ R_ELEV_MAX (${R_ELEV_MAX})`;
    }

    console.log(`\n🎯 STEP 4: Fee Tier Determination`);
    console.log(`   Threshold Rules:`);
    console.log(`      - RETAIL:    Rnow < 0.3  → Fee = 3000 bps (0.30%)`);
    console.log(`      - ELEVATED:  0.3 ≤ Rnow < 0.7  → Fee = 6000 bps (0.60%)`);
    console.log(`      - TOXIC:     Rnow ≥ 0.7  → Fee = 15000 bps (1.50%)`);
    console.log(`\n   Applied Logic:`);
    console.log(`      ${tierLogic}`);
    console.log(`      → Expected Tier: ${expectedTier}`);
    console.log(`      → Expected Fee: ${expectedFee} bps (${(expectedFee / 10000).toFixed(2)}%)`);

    console.log(`\n⏳ STEP 5: Executing Swap...`);

    // Execute swap
    const CurrentConfig = {
        poolKey: {
            currency0: token0,
            currency1: token1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: HOOK,
        },
        zeroForOne: isEthToken0,
        amountIn: amountInWei.toString(),
        amountOutMinimum: "0",
        hookData: "0x",
    };

    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [CurrentConfig]);
    v4Planner.addAction(Actions.SETTLE_ALL, [CurrentConfig.poolKey.currency0, CurrentConfig.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [CurrentConfig.poolKey.currency1, CurrentConfig.amountOutMinimum]);

    const encodedActions = v4Planner.finalize();
    routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

    const UNIVERSAL_ROUTER_ABI = [
        {
            inputs: [
                { internalType: "bytes", name: "commands", type: "bytes" },
                { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
                { internalType: "uint256", name: "deadline", type: "uint256" },
            ],
            name: "execute",
            outputs: [],
            stateMutability: "payable",
            type: "function",
        },
    ];

    const ur = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, wallet);
    const tx = await ur.execute(routePlanner.commands, routePlanner.inputs, deadline, {
        value: 0,
        gasLimit: 1000000
    });

    const receipt = await tx.wait();
    console.log(`   Transaction Hash: ${tx.hash}`);
    console.log(`   Block Number: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

    // Parse event
    const HOOK_ABI = [
        "event SwapRecorded(bytes32 indexed swapId, bytes32 indexed poolId, address indexed sender, uint256 agentId, uint160 sqrtPriceBeforeX96, uint160 sqrtPriceAfterX96, uint24 feeBps, uint256 Rnow)"
    ];
    const hookInterface = new ethers.utils.Interface(HOOK_ABI);

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === HOOK.toLowerCase()) {
            try {
                const parsed = hookInterface.parseLog(log);
                if (parsed.name === "SwapRecorded") {
                    const actualFee = parsed.args.feeBps.toString();
                    const actualRnow = parseFloat(ethers.utils.formatUnits(parsed.args.Rnow, 18));

                    console.log(`\n✅ STEP 6: Actual Results from Hook Event`);
                    console.log(`   SwapRecorded Event Data:`);
                    console.log(`      Rnow (actual): ${actualRnow.toFixed(8)}`);
                    console.log(`      Fee Bps (actual): ${actualFee}`);
                    console.log(`      SqrtPrice Before: ${parsed.args.sqrtPriceBeforeX96.toString()}`);
                    console.log(`      SqrtPrice After: ${parsed.args.sqrtPriceAfterX96.toString()}`);

                    const match = actualFee === expectedFee.toString() ? "✓" : "✗";
                    console.log(`\n   Verification:`);
                    console.log(`      ${match} Expected Fee: ${expectedFee} bps`);
                    console.log(`      ${match} Actual Fee:   ${actualFee} bps`);
                    console.log(`      Rnow Diff: ${Math.abs(actualRnow - rnowCalculated).toFixed(8)}`);

                    // Fee economics
                    const inputAmount = parseFloat(amountEth);
                    const feeRate = parseFloat(actualFee) / 10000; // Convert bps to decimal
                    const feeAmount = inputAmount * feeRate;
                    const netAmount = inputAmount - feeAmount;

                    console.log(`\n💰 STEP 7: Fee Economics`);
                    console.log(`   Input Amount:     ${amountEth} ETH`);
                    console.log(`   Fee Rate:         ${actualFee} bps = ${feeRate.toFixed(4)}%`);
                    console.log(`   Fee Deducted:     ${feeAmount.toFixed(8)} ETH`);
                    console.log(`   Net for Swap:     ${netAmount.toFixed(8)} ETH`);

                    console.log(`\n📊 Comparison Across All Tiers:`);
                    const tiers = [
                        { name: "PARTNER ", bps: 500, desc: "(bonded agents only)" },
                        { name: "RETAIL  ", bps: 3000, desc: "" },
                        { name: "ELEVATED", bps: 6000, desc: "" },
                        { name: "TOXIC   ", bps: 15000, desc: "" }
                    ];

                    tiers.forEach(t => {
                        const tierFeeRate = t.bps / 10000;
                        const tierFeeAmount = inputAmount * tierFeeRate;
                        const saved = t.bps === parseFloat(actualFee) ? 0 : feeAmount - tierFeeAmount;
                        const marker = t.bps === parseFloat(actualFee) ? " ← YOUR TIER" : saved > 0 ? ` (would save ${saved.toFixed(8)} ETH)` : ` (would pay ${Math.abs(saved).toFixed(8)} ETH more)`;
                        console.log(`   ${t.name}: ${t.bps.toString().padStart(5)} bps → ${tierFeeAmount.toFixed(8)} ETH${marker} ${t.desc}`);
                    });

                    return {
                        rnowCalculated,
                        rnowActual: actualRnow,
                        feeExpected: expectedFee,
                        feeActual: actualFee,
                        tier: expectedTier
                    };
                }
            } catch (e) { }
        }
    }

    console.log("\n❌ Could not find SwapRecorded event");
    return null;
}

async function main() {
    console.log("\n╔═══════════════════════════════════════════════════════════════════════════════════════════════╗");
    console.log("║                    AminoRiskFeeHook - Dynamic Fee Demonstration                               ║");
    console.log("╚═══════════════════════════════════════════════════════════════════════════════════════════════╝");

    const testAmounts = ["0.0003", "0.0005", "0.001"];

    for (let i = 0; i < testAmounts.length; i++) {
        await demonstrateSwap(testAmounts[i]);

        if (i < testAmounts.length - 1) {
            console.log("\n⏸️  Waiting 3 seconds before next swap...\n");
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log("\n" + "=".repeat(100));
    console.log("✅ DEMONSTRATION COMPLETE");
    console.log("=".repeat(100) + "\n");
}

main().catch(console.error);
