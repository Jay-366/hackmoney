// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

// Your hook contract
import {AminoRiskFeeHook} from "../src/AminoRiskFeeHook.sol";

// Uniswap v4 PoolManager interface
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "../lib/v4-periphery/src/utils/HookMiner.sol";

contract DeployAminoRiskFeeHookScript is Script {
    // Sepolia PoolManager (Uniswap v4)
    address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external returns (AminoRiskFeeHook hook) {
        // Mining salt for correct flags (BeforeSwap + AfterSwap)
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(AminoRiskFeeHook).creationCode,
            abi.encode(IPoolManager(SEPOLIA_POOL_MANAGER))
        );

        vm.startBroadcast();

        hook = new AminoRiskFeeHook{salt: salt}(IPoolManager(SEPOLIA_POOL_MANAGER));

        require(address(hook) == hookAddress, "Hook address mismatch");

        vm.stopBroadcast();

        console2.log("AminoRiskFeeHook deployed at:", address(hook));
    }
}
