import { ethers } from "ethers";

// Pool liquidity from earlier: ~1e15 wei = 0.001 ETH
const LIQUIDITY = 1000994340808720;
const K = 100; // Price impact constant

console.log("🔍 Finding Swap Amount for TOXIC Tier (Rnow ≥ 0.7)\n");
console.log("=".repeat(80));

// Target: Rnow = 0.7
// Formula: Rnow = 0.6 × I + 0.4 × S
// Where: I = amt / (amt + K) and S = amt / L

// Since S dominates (I is tiny for small amounts), we need S to be very high
// For Rnow = 0.7 with I ≈ 0: S needs to be 1.75 (but S is capped at 1.0 in the hook)
// With S capped at 1.0: Rnow = 0.6 × I + 0.4

// To get Rnow = 0.7, we need: 0.6 × I = 0.3, so I = 0.5
// For I = 0.5: amt / (amt + 100) = 0.5 → amt = 100 ETH (too large!)

// Practical approach: Try larger amounts and see what Rnow we get

const testAmounts = [
    0.001,  // Known: Rnow ≈ 0.40 (ELEVATED)
    0.002,  // Test
    0.003,  // Test
    0.005,  // Test
    0.01,   // Test
];

console.log("\n📊 Predicted Rnow for Different Swap Amounts:\n");
console.log("Amount (ETH) | Price Impact (I) | Liq Stress (S) | Rnow | Expected Tier");
console.log("-".repeat(80));

testAmounts.forEach(amountEth => {
    const amountWei = amountEth * 1e18;

    // Price Impact: I = amt / (amt + K)
    const I = amountWei / (amountWei + K * 1e18);

    // Liquidity Stress: S = amt / L (capped at 1.0)
    let S = amountWei / LIQUIDITY;
    if (S > 1.0) S = 1.0;

    // Combined: Rnow = 0.6 × I + 0.4 × S
    const Rnow = 0.6 * I + 0.4 * S;

    let tier;
    if (Rnow < 0.3) tier = "RETAIL (3000 bps)";
    else if (Rnow < 0.7) tier = "ELEVATED (6000 bps)";
    else tier = "TOXIC (15000 bps)";

    console.log(
        `${amountEth.toString().padEnd(12)} | ${I.toFixed(8).padEnd(17)} | ${S.toFixed(8).padEnd(14)} | ${Rnow.toFixed(4).padEnd(4)} | ${tier}`
    );
});

console.log("\n" + "=".repeat(80));
console.log("\n💡 Recommendation:\n");
console.log("Based on current pool liquidity (~0.001 ETH), you need to swap amounts");
console.log("that are MUCH larger than the pool's liquidity to reach TOXIC tier.");
console.log("");
console.log("🎯 Try swapping: 0.002 ETH or larger");
console.log("");
console.log("Update runDemo.ts line 232:");
console.log('  const testAmounts = ["0.0003", "0.001", "0.002"];');
console.log("");
console.log("⚠️  Note: With such low pool liquidity (0.001 ETH), even 0.002 ETH");
console.log("might not reach TOXIC. Consider swapping 0.01 ETH for guaranteed TOXIC tier.");
console.log("");
