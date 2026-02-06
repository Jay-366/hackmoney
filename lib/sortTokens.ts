import { getAddress } from "viem";

export function sortTokens(tokenA: string, tokenB: string): [string, string, boolean] {
    const addressA = getAddress(tokenA);
    const addressB = getAddress(tokenB);

    // Sort based on lowercase values to match Solidity behavior
    const isSorted = addressA.toLowerCase() < addressB.toLowerCase();
    const currency0 = isSorted ? addressA : addressB;
    const currency1 = isSorted ? addressB : addressA;
    const swapped = !isSorted;

    return [currency0, currency1, swapped];
}
