// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/PoolRegistry.sol";

contract DeployPoolRegistry is Script {
    function run() external {
        vm.startBroadcast();
        PoolRegistry registry = new PoolRegistry();
        vm.stopBroadcast();

        console2.log("PoolRegistry deployed at:", address(registry));
    }
}
