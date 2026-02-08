import { ethers } from "ethers";

console.log("📊 AminoRiskFeeHook Fee Tier Demonstration");
console.log("=".repeat(80));
console.log("\n🧮 Rnow Calculation Formula:");
console.log("   Rnow = (W_I × PriceImpact + W_S × LiquidityStress)");
console.log("   W_I = 0.6 (Price Impact Weight)");
console.log("   W_S = 0.4 (Liquidity Stress Weight)\n");

// Current pool state
const LIQUIDITY = "1000994340808720"; // ~1e15
const PRICE_IMPACT_K = "100000000000000000000"; // 1e20

console.log("Pool State:");
console.log(`   Liquidity: ${LIQUIDITY}`);
console.log(`   Price Impact K: ${PRICE_IMPACT_K}\n`);

console.log("=".repeat(80));
console.log("\n🎯 Fee Tier Thresholds:\n");

const tiers = [
    { name: "RETAIL", rnow: "< 0.3", fee: "3000 (0.30%)" },
    { name: "ELEVATED", rnow: "0.3 - 0.7", fee: "6000 (0.60%)" },
    { name: "TOXIC", rnow: "> 0.7", fee: "15000 (1.50%)" }
];

tiers.forEach((tier, i) => {
    console.log(`${i + 1}. ${tier.name.padEnd(10)} Rnow: ${tier.rnow.padEnd(12)} Fee: ${tier.fee}`);
});

console.log("\n" + "=".repeat(80));
console.log("\n💡 Sample Swap Amounts (Based on Approximation):\n");

// These are rough estimates - actual values depend on price impact calculation
const samples = [
    {
        tier: "RETAIL",
        amount: "0.0003",
        expectedRnow: "~0.25",
        expectedFee: "3000",
        notes: "Small swap, low risk"
    },
    {
        tier: "ELEVATED",
        amount: "0.0005",
        expectedRnow: "~0.50",
        expectedFee: "6000",
        notes: "Medium swap, moderate risk"
    },
    {
        tier: "ELEVATED",
        amount: "0.1",
        expectedRnow: "~0.40",
        expectedFee: "6000",
        notes: "Current test amount (observed in logs)"
    },
    {
        tier: "TOXIC",
        amount: "0.001",
        expectedRnow: "~0.80",
        expectedFee: "15000",
        notes: "Large swap, high risk"
    }
];

samples.forEach((s, i) => {
    console.log(`${i + 1}. ${s.tier} Tier:`);
    console.log(`   Swap: ${s.amount} ETH`);
    console.log(`   Expected Rnow: ${s.expectedRnow}`);
    console.log(`   Expected Fee Bps: ${s.expectedFee}`);
    console.log(`   Notes: ${s.notes}`);
    console.log();
});

console.log("=".repeat(80));
console.log("\n📝 How to Test:\n");
console.log("1. Open: scripts/agentSwap.ts or scripts/retailSwap.ts");
console.log('2. Find line with: const amountInWei = ...');
console.log('3. Replace with: ethers.utils.parseUnits("<AMOUNT>", 18).toString()');
console.log("   Where <AMOUNT> is one of the values above (e.g., 0.0003, 0.0005, 0.001)");
console.log("");
console.log("4. Run the swap:");
console.log("   bun scripts/agentSwap.ts");
console.log("");
console.log("5. Check output for:");
console.log("   - Fee Bps: <value>");
console.log("   - Rnow: <value>");
console.log("");

console.log("=".repeat(80));
console.log("\n⚠️  Important Notes:\n");
console.log("• The EXACT Rnow depends on:");
console.log("  - Liquidity Stress: (swapAmount / poolLiquidity)");
console.log("  - Price Impact: complex function of swap size");
console.log("  - Weighted combination: 0.6×Impact + 0.4×Stress");
console.log("");
console.log("• For PARTNER tier (500 bps = 0.05%):");
console.log("  - Need bonded agent (≥0.05 ETH bond)");
console.log("  - Need Rnow < 0.1");
console.log("  - Currently NOT available (no bonded agents)");
console.log("");
console.log("• Current 0.1 ETH swaps show Rnow ≈ 0.40");
console.log("  → Falls into ELEVATED tier (6000 bps)");
console.log("");
