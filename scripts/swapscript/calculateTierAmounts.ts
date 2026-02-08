import { ethers } from "ethers";

// Pool liquidity from checkPoolLiquidityForSwap.ts
const LIQUIDITY = ethers.BigNumber.from("1000994340808720");

// Risk thresholds from AminoRiskFeeHook.sol
const R_PARTNER_MAX = 0.1;  // 1e17
const R_RETAIL_MAX = 0.3;   // 3e17
const R_ELEV_MAX = 0.7;     // 7e17

// Fee tiers
const FEES = {
    PARTNER: { bps: 500, percent: "0.05%" },
    RETAIL: { bps: 3000, percent: "0.30%" },
    ELEV: { bps: 6000, percent: "0.60%" },
    TOXIC: { bps: 15000, percent: "1.50%" }
};

console.log("📊 AminoRiskFeeHook - Swap Amount Calculator\n");
console.log("=".repeat(80));
console.log(`Pool Liquidity: ${LIQUIDITY.toString()} (~${ethers.utils.formatUnits(LIQUIDITY, 0)} wei)`);
console.log("=".repeat(80));

// Calculate liquidity stress for a given swap amount
function calculateStress(swapAmountWei: string): number {
    const amount = ethers.BigNumber.from(swapAmountWei);
    const stress = amount.mul(ethers.BigNumber.from("1000000000000000000")).div(LIQUIDITY);
    return parseFloat(ethers.utils.formatUnits(stress, 18));
}

// Find swap amount for target stress
function findSwapAmount(targetStress: number): ethers.BigNumber {
    // stress = (amount * 1e18) / L
    // amount = (stress * L) / 1e18
    const stressWei = ethers.utils.parseUnits(targetStress.toString(), 18);
    return stressWei.mul(LIQUIDITY).div(ethers.BigNumber.from("1000000000000000000"));
}

console.log("\n🎯 Target Swap Amounts for Each Fee Tier:\n");

// Tier 1: RETAIL (Rnow < 0.3)
const retailAmount = findSwapAmount(0.25); // Target 0.25 to stay under 0.3
console.log("1️⃣  RETAIL Tier (0.30% fee)");
console.log(`   Target Rnow: < ${R_RETAIL_MAX}`);
console.log(`   Swap Amount: ${ethers.utils.formatEther(retailAmount)} ETH`);
console.log(`   Calculated Stress: ${calculateStress(retailAmount.toString()).toFixed(6)}`);
console.log(`   Command: Update amountInWei to "${retailAmount.toString()}"`);
console.log();

// Tier 2: ELEVATED (0.3 < Rnow < 0.7)
const elevAmount = findSwapAmount(0.5); // Target 0.5 in the middle
console.log("2️⃣  ELEVATED Tier (0.60% fee)");
console.log(`   Target Rnow: ${R_RETAIL_MAX} - ${R_ELEV_MAX}`);
console.log(`   Swap Amount: ${ethers.utils.formatEther(elevAmount)} ETH`);
console.log(`   Calculated Stress: ${calculateStress(elevAmount.toString()).toFixed(6)}`);
console.log(`   Command: Update amountInWei to "${elevAmount.toString()}"`);
console.log();

// Tier 3: TOXIC (Rnow > 0.7)
const toxicAmount = findSwapAmount(0.8); // Target 0.8 over the limit
console.log("3️⃣  TOXIC Tier (1.50% fee)");
console.log(`   Target Rnow: > ${R_ELEV_MAX}`);
console.log(`   Swap Amount: ${ethers.utils.formatEther(toxicAmount)} ETH`);
console.log(`   Calculated Stress: ${calculateStress(toxicAmount.toString()).toFixed(6)}`);
console.log(`   Command: Update amountInWei to "${toxicAmount.toString()}"`);
console.log();

// Current swap (for reference)
const currentSwap = ethers.utils.parseEther("0.1");
console.log("📌 Current Swap (from agentSwap.ts):");
console.log(`   Amount: 0.1 ETH`);
console.log(`   Calculated Stress: ${calculateStress(currentSwap.toString()).toFixed(6)}`);
console.log(`   Expected Tier: ELEVATED (matches observed 6000 bps)`);
console.log();

console.log("=".repeat(80));
console.log("\n💡 Usage Instructions:\n");
console.log("1. Copy one of the swap amounts above");
console.log("2. Update agentSwap.ts line 61:");
console.log('   const amountInWei = "<PASTE_VALUE_HERE>";');
console.log("3. Run: bun scripts/agentSwap.ts");
console.log("4. Observe the Fee Bps in the output");
console.log();
console.log("Expected Results:");
console.log("  - RETAIL:    Fee Bps = 3000");
console.log("  - ELEVATED:  Fee Bps = 6000");
console.log("  - TOXIC:     Fee Bps = 15000");
console.log();
