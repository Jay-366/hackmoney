export const ANVIL_CHAIN_ID = 31337;
export const SEPOLIA_CHAIN_ID = 11155111;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export function getPositionManagerAddress(chainId: number): string | undefined {
    if (chainId === ANVIL_CHAIN_ID) {
        const envAddress = process.env.NEXT_PUBLIC_V4_POSITION_MANAGER;
        if (!envAddress) {
            console.error("Missing NEXT_PUBLIC_V4_POSITION_MANAGER for Anvil");
            return undefined;
        }
        return envAddress;
    }

    if (chainId === SEPOLIA_CHAIN_ID) {
        return "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4";
    }

    if (chainId === BASE_SEPOLIA_CHAIN_ID) {
        return "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80";
    }

    return undefined;
}

export function getPoolManagerAddress(chainId: number): string | undefined {
    if (chainId === ANVIL_CHAIN_ID) {
        const envAddress = process.env.NEXT_PUBLIC_V4_POOL_MANAGER;
        if (!envAddress) {
            console.error("Missing NEXT_PUBLIC_V4_POOL_MANAGER for Anvil");
            return undefined;
        }
        return envAddress;
    }

    if (chainId === SEPOLIA_CHAIN_ID) {
        return "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
    }

    if (chainId === BASE_SEPOLIA_CHAIN_ID) {
        // Fallback or specific address for Base Sepolia PoolManager if known.
        // For now preventing undefined return if user tries Base Sepolia, 
        // assuming similar deployment pattern or returning undefined if unknown.
        // Address 0x4b2c... was PositionManager.
        // I will return undefined for Base Sepolia PoolManager unless I find it.
        // Actually, user only provided Sepolia PoolManager.
        return undefined;
    }

    return undefined;
}
