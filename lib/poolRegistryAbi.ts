export const POOL_REGISTRY_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "currency0", "type": "address" },
                    { "internalType": "address", "name": "currency1", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
                    { "internalType": "address", "name": "hooks", "type": "address" }
                ],
                "internalType": "struct PoolKey",
                "name": "key",
                "type": "tuple"
            }
        ],
        "name": "register",
        "outputs": [{ "internalType": "bytes32", "name": "poolId", "type": "bytes32" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalPools",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "start", "type": "uint256" },
            { "internalType": "uint256", "name": "limit", "type": "uint256" }
        ],
        "name": "listPoolIds",
        "outputs": [{ "internalType": "bytes32[]", "name": "out", "type": "bytes32[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "hooks", "type": "address" }],
        "name": "countByHook",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "hooks", "type": "address" },
            { "internalType": "uint256", "name": "start", "type": "uint256" },
            { "internalType": "uint256", "name": "limit", "type": "uint256" }
        ],
        "name": "listPoolIdsByHook",
        "outputs": [{ "internalType": "bytes32[]", "name": "out", "type": "bytes32[]" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes32", "name": "poolId", "type": "bytes32" }],
        "name": "getPool",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "currency0", "type": "address" },
                    { "internalType": "address", "name": "currency1", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
                    { "internalType": "address", "name": "hooks", "type": "address" },
                    { "internalType": "uint256", "name": "createdAt", "type": "uint256" },
                    { "internalType": "address", "name": "creator", "type": "address" }
                ],
                "internalType": "struct PoolRegistry.PoolInfo",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "currency0", "type": "address" },
                    { "internalType": "address", "name": "currency1", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
                    { "internalType": "address", "name": "hooks", "type": "address" }
                ],
                "internalType": "struct PoolKey",
                "name": "key",
                "type": "tuple"
            }
        ],
        "name": "computePoolId",
        "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "stateMutability": "pure",
        "type": "function"
    }
] as const;
