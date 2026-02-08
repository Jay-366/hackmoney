import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
let PRIVATE_KEY = process.env.PRIVATE_KEY!;
if (!PRIVATE_KEY.startsWith("0x")) PRIVATE_KEY = `0x${PRIVATE_KEY}`;

const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
const POOL_REGISTRY = "0xF995fB0554d39fDe02868470bFD2E2E2e9A043e1";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";

const HOOK = "0x0751475F21877c8906C74d50546aaaBD1AF140C0";
const FEE = 5000; // 0.5%
const TICK_SPACING = 60;

const POOL_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "key",
        type: "tuple",
      },
      { name: "sqrtPriceX96", type: "uint160" },
    ],
    name: "initialize",
    outputs: [{ name: "tick", type: "int24" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const REGISTRY_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "key",
        type: "tuple",
      },
    ],
    name: "register",
    outputs: [{ name: "poolId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ✅ this exists in your contract
  {
    inputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "key",
        type: "tuple",
      },
    ],
    name: "computePoolId",
    outputs: [{ name: "poolId", type: "bytes32" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [{ name: "poolId", type: "bytes32" }],
    name: "getPool",
    outputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
          { name: "createdAt", type: "uint256" },
          { name: "creator", type: "address" },
        ],
        name: "info",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

function sortTokens(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

function msgOf(e: any): string {
  return e?.error?.message || e?.data?.message || e?.message || String(e);
}

// 1:1 “human parity” for ETH(18) vs USDC(6) (handles ordering)
function sqrtPriceParity(token0: string): ethers.BigNumber {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const ONE_E6 = ethers.BigNumber.from(10).pow(6);
  return token0.toLowerCase() === ETH.toLowerCase() ? Q96.div(ONE_E6) : Q96.mul(ONE_E6);
}

async function main() {
  console.log("\n🎉 Setup Pool + Register in PoolRegistry");
  console.log("=".repeat(80));
  console.log("RPC:", RPC);
  console.log("POOL_MANAGER:", POOL_MANAGER);
  console.log("POOL_REGISTRY:", POOL_REGISTRY);
  console.log("HOOK:", HOOK);
  console.log("FEE:", FEE, "TICK_SPACING:", TICK_SPACING);
  console.log("=".repeat(80), "\n");

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);

  const [token0, token1] = sortTokens(ETH, USDC);

  const poolKey = {
    currency0: token0,
    currency1: token1,
    fee: FEE,
    tickSpacing: TICK_SPACING,
    hooks: HOOK,
  };

  const sqrtPriceX96 = sqrtPriceParity(token0);

  console.log("\nPoolKey:", poolKey);
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());

  const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);
  const registry = new ethers.Contract(POOL_REGISTRY, REGISTRY_ABI, wallet);

  // ✅ ALWAYS get poolId (even if already registered)
  const poolId: string = await registry.computePoolId(poolKey);
  console.log("\n✅ poolId (computePoolId):", poolId);

  // 1) Initialize (may revert if already initialized or other reason)
  console.log("\n[1/3] Initializing pool...");
  try {
    const tx = await poolManager.initialize(poolKey, sqrtPriceX96, { gasLimit: 1_500_000 });
    console.log("init tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ initialized. block:", receipt.blockNumber);
  } catch (e: any) {
    console.log("⚠️ initialize reverted:", msgOf(e));
    console.log("   (This is OK if it was already initialized.)");
  }

  // 2) Register (will revert if already registered)
  console.log("\n[2/3] Registering pool in PoolRegistry...");
  try {
    const tx = await registry.register(poolKey, { gasLimit: 800_000 });
    console.log("register tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ registered. block:", receipt.blockNumber);
  } catch (e: any) {
    const msg = msgOf(e);
    if (msg.includes("ALREADY_REGISTERED")) {
      console.log("✅ already registered (confirmed)");
    } else {
      console.log("❌ register failed:", msg);
      throw e;
    }
  }

  // 3) Verify registry record exists
  console.log("\n[3/3] Verifying registry record via getPool(poolId)...");
  const info = await registry.getPool(poolId);
  console.log("✅ registry record found:");
  console.log("  currency0:", info.currency0);
  console.log("  currency1:", info.currency1);
  console.log("  fee:", info.fee.toString());
  console.log("  tickSpacing:", info.tickSpacing.toString());
  console.log("  hooks:", info.hooks);
  console.log("  creator:", info.creator);
  console.log("  createdAt:", info.createdAt.toString());

  console.log("\n" + "=".repeat(80));
  console.log("🎉 DONE");
  console.log("=".repeat(80));
  console.log("Pool ID:", poolId);
  console.log(`Add Liquidity URL: http://localhost:3000/positions/create?poolId=${poolId}\n`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
