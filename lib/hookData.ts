// app/lib/hookData.ts
import { ethers } from "ethers";

/**
 * Amino HookData v1 (simple, validation optional later)
 *
 * hookData = abi.encode(
 *   uint256 agentId,
 *   bytes   proof   // mocked now; can be real ZK proof later
 * )
 *
 * Notes:
 * - If user doesn't know about your system, they can swap with hookData = "0x".
 * - Your hook should treat empty hookData as "anonymous" (no partner perks).
 */

export type HookDataParams = {
    agentId: bigint;
    proof?: `0x${string}`; // optional; mocked if omitted
};

/** Hackathon mock proof generator (placeholder for ZK later) */
export function mockProof(): `0x${string}` {
    return "0x";
}

/** Encode hookData bytes to pass into Uniswap v4 swap config */
export function encodeHookData(p: HookDataParams): `0x${string}` {
    const proof = p.proof ?? mockProof();

    const encoded = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "bytes"],
        [p.agentId, proof]
    );

    return encoded as `0x${string}`;
}

/** Optional: decode hookData for debugging */
export function decodeHookData(hookData: `0x${string}`): {
    agentId: bigint;
    proof: `0x${string}`;
} {
    const [agentId, proof] = ethers.utils.defaultAbiCoder.decode(
        ["uint256", "bytes"],
        hookData
    );

    return {
        agentId: agentId as bigint,
        proof: proof as `0x${string}`,
    };
}

/** Convenience: detect whether hookData is present */
export function isEmptyHookData(hookData?: string | null): boolean {
    if (!hookData) return true;
    const normalized = hookData.toLowerCase();
    return normalized === "0x" || normalized === "0x0" || normalized === "";
}
