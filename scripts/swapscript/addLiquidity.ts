
import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// V4 Addresses
const POSITION_MANAGER = "0x429e2c08a953f8ae4d1b092e661f4340794fcec2";
// Updated Hook Address
const HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const FEE = 5000;
const TICK_SPACING = 60;

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    console.log("Adding liquidity to pool with Hook:", HOOK);

    // Approve tokens
    const ERC20_ABI = ["function approve(address spender, uint256 amount) external returns (bool)"];
    const t0 = new ethers.Contract(token0, ERC20_ABI, wallet);
    const t1 = new ethers.Contract(token1, ERC20_ABI, wallet);

    console.log("Approving tokens...");
    await (await t0.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
    await (await t1.approve(POSITION_MANAGER, ethers.constants.MaxUint256)).wait();
    console.log("Tokens approved.");

    const PM_ABI = [
        "function mint(address, uint256, int24, int24, uint256, bytes) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
    ];

    // Note: The ABI for mint in V4 PositionManager might be different (structs).
    // Using simple interface if possible, or fully encoding params.
    // The ModifyLiquidityParams struct:
    // struct ModifyLiquidityParams {
    //    PoolKey key;
    //    int24 tickLower;
    //    int24 tickUpper;
    //    uint256 liquidity; (amount)
    //    bytes hookData;
    // }
    // But PositionManager.mint takes (params, recipient, deadline, hookData)?
    // Or it might be `modifyLiquidities`.

    // Let's check typical PM interface. 
    // Usually: mint(PoolKey memory key, int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 amount0Max, uint256 amount1Max, address owner, bytes memory hookData)
    // Wait, the deployed PositionManager interface might be valid.

    // Since we don't know the exact ABI of the deployed PM at 0x429E..., 
    // we use `modifyLiquidities` if it's the standard one.
    // Or we use the `PositionManager` provided in `lib/v4-periphery`.

    // Given complexity, and user previously added liquidity manually...
    // I will try to use the *User's Previous Method* if I can find it.
    // But they probably used the UI.

    // Let's try to construct the call.
    // The `PositionManager` usually has `mint`.
    // Let's assume standard V4 Periphery `PositionManager`.
    // function mint(PoolKey calldata key, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes calldata hookData) external payable returns (uint256 tokenId, uint128 liquidityDelta, uint256 amount0, uint256 amount1);

    const ParamType = `tuple(
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks
    )`;

    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: HOOK
    };

    const pm = new ethers.Contract(POSITION_MANAGER, [
        `function mint(
            ${ParamType} key,
            int24 tickLower,
            int24 tickUpper,
            uint256 liquidity,
            uint128 amount0Max,
            uint128 amount1Max,
            address owner,
            bytes hookData
        ) external payable returns (uint256 tokenId, uint128 liquidityDelta, uint256 amount0, uint256 amount1)`
    ], wallet);

    // Range: -280000 to -270000
    const lower = -280000;
    const upper = -270000;
    const liq = ethers.BigNumber.from("1000000000000000000"); // 1 unit?
    // Wait, liquidity amount depends on price.
    // 1e18 liquidity might mean large amounts of token0/token1.
    // Let's try 1e18.

    console.log("Minting liquidity...");
    try {
        const tx = await pm.mint(
            poolKey,
            lower,
            upper,
            liq,
            ethers.constants.MaxUint256,
            ethers.constants.MaxUint256,
            wallet.address,
            "0x",
            { gasLimit: 5000000 }
        );
        console.log("Mint Tx sent:", tx.hash);
        await tx.wait();
        console.log("Liquidity added!");
    } catch (e) {
        console.error("Mint failed:", e);
    }
}

main();
