import { createPublicClient, http, parseAbi } from "viem";

const ERC20_DECIMALS_ABI = parseAbi([
    "function decimals() view returns (uint8)"
]);

export async function getTokenDecimals(publicClient: any, tokenAddress: string, isNative: boolean): Promise<number> {
    if (isNative) return 18;
    try {
        const decimals = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_DECIMALS_ABI,
            functionName: "decimals"
        });
        return decimals;
    } catch (e) {
        console.warn("Failed to fetch decimals for", tokenAddress, e);
        return 18; // Default fallback
    }
}
