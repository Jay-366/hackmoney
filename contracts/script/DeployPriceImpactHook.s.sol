// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";


import {PriceImpactHook} from "../src/PriceImpactHook.sol";

contract DeployPriceImpactHook is Script {
    // Uniswap v4 PoolManager on Ethereum Sepolia
    address constant POOL_MANAGER =
        0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

    // EIP-2470 CREATE2 deployer (used by Uniswap docs)
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        // Require BEFORE_SWAP + AFTER_SWAP
        uint160 flags =
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        bytes memory constructorArgs =
            abi.encode(IPoolManager(POOL_MANAGER));

        (address expected, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(PriceImpactHook).creationCode,
            constructorArgs
        );

        vm.startBroadcast();

        PriceImpactHook hook =
            new PriceImpactHook{salt: salt}(IPoolManager(POOL_MANAGER));

        vm.stopBroadcast();

        require(address(hook) == expected, "HOOK_ADDRESS_MISMATCH");

        console2.log("PriceImpactHook deployed at:", address(hook));
    }
}
