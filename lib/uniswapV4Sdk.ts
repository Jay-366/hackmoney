import { Token, Percent } from '@uniswap/sdk-core';
import { Pool, Position, V4PositionManager } from '@uniswap/v4-sdk';
import { PublicClient } from 'viem';
import { STATE_VIEW_ABI } from './stateViewAbi';
import { POOL_MANAGER_ABI } from './poolManagerAbi';

/**
 * Create a Token instance from address and metadata
 */
export function createToken(
    chainId: number,
    address: string,
    decimals: number,
    symbol?: string,
    name?: string
): Token {
    return new Token(chainId, address, decimals, symbol, name);
}

/**
 * Fetch pool state from chain and create Pool instance
 */
export async function createPoolFromChain(
    publicClient: PublicClient,
    chainId: number,
    poolManagerAddress: string,
    stateViewAddress: string | undefined,
    token0: Token,
    token1: Token,
    fee: number,
    tickSpacing: number,
    hooks: string,
    poolId: string
): Promise<Pool> {
    // Fetch slot0 from StateView or PoolManager
    const targetAddress = stateViewAddress || poolManagerAddress;
    const targetAbi = stateViewAddress ? STATE_VIEW_ABI : POOL_MANAGER_ABI;

    const slot0 = await publicClient.readContract({
        address: targetAddress as `0x${string}`,
        abi: targetAbi,
        functionName: 'getSlot0',
        args: [poolId as `0x${string}`]
    });

    const sqrtPriceX96 = slot0[0];
    const tick = Number(slot0[1]);

    // For liquidity, we need to read from PoolManager
    // V4 doesn't have a direct getLiquidity view, so we use 0 as placeholder
    // The SDK will recalculate based on position amounts
    const liquidity = 0n;

    return new Pool(
        token0,
        token1,
        fee,
        tickSpacing,
        hooks,
        sqrtPriceX96.toString(),
        liquidity.toString(),
        tick
    );
}

/**
 * Create a Position from desired token amounts
 */
export function createPositionFromAmounts(
    pool: Pool,
    tickLower: number,
    tickUpper: number,
    amount0Desired: bigint,
    amount1Desired: bigint,
    useFullPrecision: boolean = true
): Position {
    return Position.fromAmounts({
        pool,
        tickLower,
        tickUpper,
        amount0: amount0Desired.toString(),
        amount1: amount1Desired.toString(),
        useFullPrecision
    });
}

/**
 * Generate mint calldata using V4PositionManager
 * Returns { calldata, value } for use with modifyLiquidities
 */
export function generateMintCalldata(
    position: Position,
    options: {
        recipient: string;
        slippageTolerance: Percent;
        deadline: bigint;
        hookData?: string;
    }
): { calldata: string; value: string } {
    const { calldata, value } = V4PositionManager.addCallParameters(position, {
        recipient: options.recipient,
        slippageTolerance: options.slippageTolerance,
        deadline: options.deadline.toString(),
        hookData: options.hookData || '0x'
    });

    return { calldata, value };
}

/**
 * Calculate amounts with slippage for a position
 */
export function getAmountsWithSlippage(
    position: Position,
    slippageTolerance: Percent
): { amount0Max: bigint; amount1Max: bigint } {
    const amounts = position.mintAmountsWithSlippage(slippageTolerance);

    return {
        amount0Max: BigInt(amounts.amount0.toString()),
        amount1Max: BigInt(amounts.amount1.toString())
    };
}
