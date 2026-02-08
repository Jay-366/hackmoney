import { ethers } from "ethers";

const LIQUIDITY = "1099867840537297"; // Updated from pool
const K = ethers.BigNumber.from("100000000000000000000"); // 100 ETH

console.log("🎯 Optimal Swap Amounts for Fee Tier Demonstration\n");
console.log("=".repeat(90));
console.log(`Pool Liquidity: ${LIQUIDITY} wei (${ethers.utils.formatUnits(LIQUIDITY, 0)} wei)\n`);

// Calculate Rnow for different swap amounts
function calculateRnow(amountEth: string) {
    const amountWei = ethers.utils.parseUnits(amountEth, 18);

    // Price Impact: I = amt / (amt + K)
    const I_num = amountWei.mul(ethers.BigNumber.from("1000000000000000000"));
    const I_den = amountWei.add(K);
    const I = parseFloat(ethers.utils.formatUnits(I_num.div(I_den), 18));

    // Liquidity Stress: S = amt / L (capped at 1.0)
    const S_num = amountWei.mul(ethers.BigNumber.from("1000000000000000000"));
    const S_raw = parseFloat(ethers.utils.formatUnits(S_num.div(ethers.BigNumber.from(LIQUIDITY)), 18));
    const S = Math.min(S_raw, 1.0);

    // Rnow = 0.6 * I + 0.4 * S
    const Rnow = 0.6 * I + 0.4 * S;

    let tier;
    if (Rnow < 0.3) tier = "RETAIL";
    else if (Rnow < 0.7) tier = "ELEVATED";
    else tier = "TOXIC";

    return { I, S, Rnow, tier };
}

const testAmounts = [
    "0.0003",  // Expected: RETAIL
    "0.0005",  // Expected: RETAIL (boundary)
    "0.001",   // Expected: ELEVATED
    "0.002",   // Expected: ELEVATED (higher)
];

console.log("📊 Calculated Results:\n");
console.log("Amount    | Price Impact | Liq Stress | Rnow   | Tier");
console.log("-".repeat(90));

testAmounts.forEach(amt => {
    const { I, S, Rnow, tier } = calculateRnow(amt);
    console.log(
        `${amt.padEnd(9)} | ${I.toFixed(8).padEnd(12)} | ${S.toFixed(6).padEnd(10)} | ${Rnow.toFixed(4).padEnd(6)} | ${tier}`
    );
});

console.log("\n" + "=".repeat(90));
console.log("\n⚠️  ISSUE DETECTED!\n");
console.log("With current liquidity (~0.001 ETH), the Liquidity Stress caps at 1.0");
console.log("This means max Rnow = 0.6×I + 0.4 ≈ 0.40 (since I is tiny)");
console.log("\n❌ CANNOT reach TOXIC tier (needs Rnow ≥ 0.7) with this liquidity!");
console.log("\n💡 SOLUTIONS:\n");
console.log("1. Add 100-1000 ETH of liquidity (recommended)");
console.log("2. Lower TOXIC threshold temporarily for demo:");
console.log("   Edit AminoRiskFeeHook.sol line 51:");
console.log("   uint256 public constant R_ELEV_MAX = 4e17; // 0.4 instead of 0.7");
console.log("\nWith solution #2, a 0.002 ETH swap would trigger 'TOXIC' tier.");
console.log("");
