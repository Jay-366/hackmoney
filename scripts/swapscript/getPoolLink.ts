import { ethers } from "ethers";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x0751475F21877c8906C74d50546aaaBD1AF140C0";
const FEE = 10000;
const TICK_SPACING = 200;

const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

const encoded = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [token0, token1, FEE, TICK_SPACING, HOOK]
);
const poolId = ethers.utils.keccak256(encoded);

console.log("Pool ID:", poolId);
console.log(`Link: http://localhost:3000/positions/create?poolId=${poolId}`);
