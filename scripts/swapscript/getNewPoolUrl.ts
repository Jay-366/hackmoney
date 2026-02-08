import { ethers } from "ethers";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x8E5AA11AD9165E247a2c8C12d3a3f873BA4340c0";
const FEE = 500;
const TICK_SPACING = 10;

// Sort tokens
const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

// Encode PoolKey
const encoded = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [token0, token1, FEE, TICK_SPACING, HOOK]
);

// Hash to get Pool ID
const poolId = ethers.utils.keccak256(encoded);

console.log("\n🆔 New Pool (fee=500) Details:");
console.log(`Token0: ${token0}`);
console.log(`Token1: ${token1}`);
console.log(`Fee: ${FEE}`);
console.log(`Tick Spacing: ${TICK_SPACING}`);
console.log(`Hook: ${HOOK}`);
console.log(`\nPool ID: ${poolId}`);
console.log(`\n✅ Use this URL to add liquidity:`);
console.log(`http://localhost:3000/positions/create?poolId=${poolId}`);
