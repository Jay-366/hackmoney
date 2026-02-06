export const POSITION_MANAGER_ABI = [
    {
        "inputs": [
            { "internalType": "bytes", "name": "data", "type": "bytes" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "name": "modifyLiquidities",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "bytes[]", "name": "data", "type": "bytes[]" }],
        "name": "multicall",
        "outputs": [{ "internalType": "bytes[]", "name": "results", "type": "bytes[]" }],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "SliceOutOfBounds",
        "type": "error"
    },
    {
        "inputs": [
            { "internalType": "bytes", "name": "actions", "type": "bytes" },
            { "internalType": "bytes[]", "name": "params", "type": "bytes[]" }
        ],
        "name": "modifyLiquiditiesWithoutUnlock",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
] as const;
