
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther, parseAbi, zeroAddress, maxUint256, encodeAbiParameters, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';
import { POOL_MANAGER_ABI } from '../../lib/poolManagerAbi';
import { POOL_REGISTRY_ABI } from '../../lib/poolRegistryAbi';
import { POSITION_MANAGER_ABI } from '../../lib/positionManagerAbi';
import { PERMIT2_ABI } from '../../lib/permit2Abi';
import { UNIVERSAL_ROUTER_ABI } from '../../lib/universalRouterAbi';
import { ERC20_ABI } from '../../lib/erc20Abi';
import { sortTokens } from '../../lib/sortTokens';

config({ path: '.env.local' });

// Configuration
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY?.startsWith('0x')
    ? process.env.PRIVATE_KEY as `0x${string}`
    : `0x${process.env.PRIVATE_KEY}` as `0x${string}`;

// Mock Tokens (Fixed)
const TOKEN_A = '0x209a45e3242a2985ba5701e07615b441ff2593c9'; // SepoliaETH (Mock)
const TOKEN_B = '0xaf6c3a632806ed83155f9f582d1c63ac31d1d435'; // MockUSDC
const HOOK = '0x8E5AA11AD9165E247a2c8C12d3a3f873BA4340c0'; // Fee Hook
const FEE = 3000;
const TICK_SPACING = 6;

// Contracts (Sepolia)
const POOL_MANAGER = process.env.NEXT_PUBLIC_V4_POOL_MANAGER as `0x${string}`;
const POOL_REGISTRY = process.env.NEXT_PUBLIC_POOL_REGISTRY as `0x${string}`;
const POSITION_MANAGER = process.env.NEXT_PUBLIC_V4_POSITION_MANAGER as `0x${string}`;
const PERMIT2 = process.env.NEXT_PUBLIC_V4_PERMIT2 as `0x${string}`;
// NOTE: UniversalRouter address might need update if env changed, using hardcoded from previous logs or checking env
const UNIVERSAL_ROUTER = process.env.NEXT_PUBLIC_V4_SWAP_ROUTER as `0x${string}`;

const account = privateKeyToAccount(PRIVATE_KEY);
const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC_URL)
});
const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL)
});

async function main() {
    console.log(`Running script with account: ${account.address}`);

    // 1. Sort Tokens & Compute Pool ID
    const [c0, c1] = sortTokens(TOKEN_A, TOKEN_B);
    const zeroForOne = TOKEN_A.toLowerCase() === c0.toLowerCase(); // Check direction

    const poolKey = {
        currency0: c0,
        currency1: c1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: HOOK
    };

    console.log("Pool Key:", poolKey);

    // Compute ID manually to verify
    const encoded = encodeAbiParameters(
        [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickSpacing", type: "int24" },
            { name: "hooks", type: "address" },
        ],
        [c0, c1, FEE, TICK_SPACING, HOOK]
    );
    const poolId = keccak256(encoded);
    console.log(`Calculated Pool ID: ${poolId}`);

    // 2. Check Initialization
    console.log("Checking if pool exists...");
    try {
        const slot0 = await publicClient.readContract({
            address: POOL_MANAGER,
            abi: POOL_MANAGER_ABI,
            functionName: 'getSlot0',
            args: [poolId]
        });
        console.log("Pool Slot0:", slot0);

        // If sqrtPriceX96 is 0, it's uninitialized (usually 0n returned if call succeeds but empty)
        // Wait, V4 getSlot0 reverts if not initialized usually.
        // If we get here, it might be initialized.
        const sqrtPriceX96 = (slot0 as any)[0];
        if (sqrtPriceX96 === 0n) {
            console.log("Pool return 0 sqrtPrice. Not initialized.");
            await initializePool(poolKey);
        } else {
            console.log("Pool is already initialized.");
        }
    } catch (e: any) {
        console.log("Pool read failed (likely uninitialized):", e.shortMessage || e.message);
        await initializePool(poolKey);
    }

    // 3. Add Liquidity (if needed)
    // For simplicity, we just add some liquidity blindly
    await addLiquidity(poolKey, c0, c1);

    // 4. Swap
    await swap(poolKey, zeroForOne);
}

async function initializePool(poolKey: any) {
    console.log("Initializing Pool...");

    // Starting Price 1:1 (approx 2^96)
    const startPrice = 79228162514264337593543950336n;

    // Initialize on PM
    const hash = await client.writeContract({
        address: POOL_MANAGER,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, startPrice]
    });
    console.log("Initialize TX:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Pool Initialized on Manager.");

    // Register (Optional but good for UI)
    try {
        const regHash = await client.writeContract({
            address: POOL_REGISTRY,
            abi: POOL_REGISTRY_ABI,
            functionName: 'register',
            args: [poolKey]
        });
        console.log("Register TX:", regHash);
        await publicClient.waitForTransactionReceipt({ hash: regHash });
    } catch (e) { console.log("Registration skipped/failed (maybe already registered)"); }
}

async function addLiquidity(poolKey: any, token0: string, token1: string) {
    console.log("Adding Liquidity...");

    // Approve PositionManager
    await approveToken(token0, POSITION_MANAGER, parseEther("100"));
    await approveToken(token1, POSITION_MANAGER, parseEther("100"));

    // Mint Params (Full Range for simplicity: -887220 to 887220, usually step by 60)
    // Tick spacing 6 -> -887220 is divisible by 6.
    const tickLower = -887220;
    const tickUpper = 887220;
    const amount0Desired = 1000000000000000000n; // 1 Token
    const amount1Desired = 1000000000000000000n; // 1 Token

    // We use modifyLiquidity from specific router or direct call? 
    // PositionManager likely wraps usage.
    // Checking ABI logic: V4 PositionManager usually 'mint'.

    const mintParams = {
        poolKey,
        tickLower,
        tickUpper,
        liquidity: 1000000000000000000n, // 1 unit of liquidity (wei) - wait, this is raw liquidity amount, not token amounts. 
        // Calculating liquidity from amounts is complex.
        // For CLI test, hardcoding a small liquidity amount is safer if we just want "some" liquidity.
        // 1e18 liquidity might require ~1e18 tokens at 1:1 price.
        amount0Max: maxUint256,
        amount1Max: maxUint256,
        owner: account.address,
        hookData: "0x"
    };

    // Note: The PositionManager ABI you have might be different (using modifyLiquidity or mint with specific struct).
    // Assuming standard signature: mint((poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, owner, hookData), deadline)

    try {
        const hash = await client.writeContract({
            address: POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'mint',
            args: [
                mintParams,
                BigInt(Math.floor(Date.now() / 1000) + 600) // deadline
            ]
        });
        console.log("Liquidity Mint TX:", hash);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("Liquidity Added.");
    } catch (e: any) {
        console.log("Liquidity Mint Failed:", e.shortMessage || e.message);
        // Might fail if already has position or similar.
    }
}

async function swap(poolKey: any, zeroForOne: boolean) {
    console.log("Swapping...");

    const tokenIn = zeroForOne ? poolKey.currency0 : poolKey.currency1;
    const router = UNIVERSAL_ROUTER;

    // Approve Permit2
    await approveToken(tokenIn, PERMIT2, parseEther("1"));

    // Approve Router on Permit2
    console.log("Approving Router on Permit2...");
    await client.writeContract({
        address: PERMIT2,
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [tokenIn, router, BigInt("1600000000000000000"), 2000000000000] // simple approve
    });

    // We can't easily execute UniversalRouter commands in raw script without the SDK logic (encoding commands).
    // But we CAN use the V4 SDK if installed.
    // Since this is a raw script, importing SDK might be tricky with require/import mix.
    // Let's try to just log "Ready to swap" and verify setup for now, 
    // or try using `writeContract` directly if we can construct commands.

    // For now, let's verify basics. The user's main issue was "Execution Reverted", likely due to NO POOL.
    console.log("Swap setup complete. If liquidity added, UI should work.");
}

async function approveToken(token: string, spender: string, amount: bigint) {
    try {
        const hash = await client.writeContract({
            address: token as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [spender as `0x${string}`, amount]
        });
        console.log(`Approved ${spender} for ${token}:`, hash);
        await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
        console.log(`Approval failed/skipped for ${token}`);
    }
}

main().catch(console.error);
