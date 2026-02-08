
import { createPublicClient, http, encodeAbiParameters, keccak256 } from 'viem';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';
import { POOL_MANAGER_ABI } from '../../lib/poolManagerAbi';
import { ERC20_ABI } from '../../lib/erc20Abi';
import { sortTokens } from '../../lib/sortTokens';

config({ path: '.env.local' });

const RPC = process.env.SEPOLIA_RPC_URL;
const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

// Pool Params
const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0xd653289FBb91eF5045bd7B71258843a77f2940C0"; // FIXED Hook
const FEE = 10000; // 1% fee - pool with FIXED hook
const TICK_SPACING = 200;

const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC)
});

async function main() {
    console.log("Checking Liquidity on Sepolia...");

    // Sort
    const [c0, c1] = sortTokens(ETH, USDC);
    console.log("Token0:", c0);
    console.log("Token1:", c1);

    const poolKey = {
        currency0: c0,
        currency1: c1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: HOOK
    };

    // Encode ID
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
    console.log(`Pool ID: ${poolId}`);

    // Check Token Decimals
    const DECIMALS_ABI = [{
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    }];

    try {
        const d0 = await publicClient.readContract({ address: c0 as `0x${string}`, abi: DECIMALS_ABI, functionName: 'decimals' });
        const d1 = await publicClient.readContract({ address: c1 as `0x${string}`, abi: DECIMALS_ABI, functionName: 'decimals' });
        console.log(`Token0 Decimals: ${d0}`);
        console.log(`Token1 Decimals: ${d1}`);
    } catch (e) { console.log("Decimals read failed:", e); }

    // Check Slot0 first
    try {
        const slot0 = await publicClient.readContract({
            address: POOL_MANAGER,
            abi: POOL_MANAGER_ABI,
            functionName: 'getSlot0',
            args: [poolId]
        });
        console.log(`Slot0:`, slot0);
    } catch (e) { console.log("Slot0 Failed (Uninitialized?)"); }

    // Check Liquidity (Mapping)
    const PM_ABI = [{
        "inputs": [{ "internalType": "bytes32", "name": "id", "type": "bytes32" }],
        "name": "getLiquidity", // Wait, V4 usually exposes `liquidity(id)`. But StateView has getLiquidity(id).
        "outputs": [{ "internalType": "uint128", "name": "", "type": "uint128" }],
        "stateMutability": "view",
        "type": "function"
    }, {
        "inputs": [{ "internalType": "bytes32", "name": "id", "type": "bytes32" }],
        "name": "liquidity",
        "outputs": [{ "internalType": "uint128", "name": "", "type": "uint128" }],
        "stateMutability": "view",
        "type": "function"
    }];

    // Try `liquidity` first (standard mapping getter)
    try {
        const liquidity = await publicClient.readContract({
            address: POOL_MANAGER,
            abi: PM_ABI,
            functionName: 'liquidity',
            args: [poolId]
        });
        console.log(`Current Liquidity (PM.liquidity): ${liquidity}`);
    } catch (e: any) {
        console.log("PM.liquidity failed:", e.shortMessage);
        // Try getLiquidity on StateView
        try {
            const svLiquidity = await publicClient.readContract({
                address: process.env.NEXT_PUBLIC_STATE_VIEW as `0x${string}`,
                abi: PM_ABI,
                functionName: 'getLiquidity',
                args: [poolId]
            });
            console.log(`Current Liquidity (StateView.getLiquidity): ${svLiquidity}`);
        } catch (e2: any) {
            console.log("StateView.getLiquidity failed:", e2.shortMessage);
        }
    }
}

main();
