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

export function getPoolRegistryAddress(chainId: number): string | undefined {
    // For Anvil, we assume a local registry might be deployed or env var Set
    if (chainId === ANVIL_CHAIN_ID) {
        return process.env.NEXT_PUBLIC_POOL_REGISTRY;
    }
    if (chainId === SEPOLIA_CHAIN_ID) {
        // Use default provided by user if env not set
        return process.env.NEXT_PUBLIC_POOL_REGISTRY || "0xF995fB0554d39fDe02868470bFD2E2E2e9A043e1";
    }
    return undefined;
}

export function getPermit2Address(chainId: number): string | undefined {
    if (chainId === ANVIL_CHAIN_ID) {
        return process.env.NEXT_PUBLIC_V4_PERMIT2;
    }
    if (chainId === SEPOLIA_CHAIN_ID) {
        return "0x000000000022D473030F116dDEE9F6B43aC78BA3";
    }
    return undefined;
}

export function getStateViewAddress(chainId: number): string | undefined {
    if (chainId === ANVIL_CHAIN_ID) {
        return process.env.NEXT_PUBLIC_STATE_VIEW;
    }
    if (chainId === SEPOLIA_CHAIN_ID) {
        return process.env.NEXT_PUBLIC_STATE_VIEW || "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
    }
    return undefined;
}

export function getUniversalRouterAddress(chainId: number): string | undefined {
    if (chainId === ANVIL_CHAIN_ID) {
        return process.env.NEXT_PUBLIC_V4_SWAP_ROUTER;
    }
    if (chainId === SEPOLIA_CHAIN_ID) {
        return "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
    }
    return undefined;
}

export function getPriceImpactHookAddress(chainId: number): string | undefined {
    if (chainId === SEPOLIA_CHAIN_ID) {
        return "0x8E5AA11AD9165E247a2c8C12d3a3f873BA4340c0";
    }
    return undefined;
}
