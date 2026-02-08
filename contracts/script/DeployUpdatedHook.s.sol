
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {AminoRiskFeeHook} from "../src/AminoRiskFeeHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "../lib/v4-periphery/src/utils/HookMiner.sol";

contract DeployUpdatedHookScript is Script {
    address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    // User provided Reputation Registry
    address constant REP_REGISTRY = 0x3bb25E47ADA8527C264c582f7763b6e5C2a8E2a6;

    function run() external returns (AminoRiskFeeHook hook) {
        address deployerAddress = vm.envAddress("DEPLOYER_ADDRESS");

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(AminoRiskFeeHook).creationCode,
            abi.encode(IPoolManager(SEPOLIA_POOL_MANAGER), deployerAddress)
        );

        vm.startBroadcast();

        hook = new AminoRiskFeeHook{salt: salt}(IPoolManager(SEPOLIA_POOL_MANAGER), deployerAddress);
        
        require(address(hook) == hookAddress, "Hook address mismatch");
        
        // Set Registry
        hook.setRegistry(REP_REGISTRY); // Points to Reputation Registry
        
        vm.stopBroadcast();

        console2.log("Updated AminoRiskFeeHook deployed at:", address(hook));
        console2.log("Registry set to:", REP_REGISTRY);
    }
}
