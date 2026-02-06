// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();

        // mint 100,000 USDC to deployer
        // 100_000 * 1e6 (because decimals=6)
        usdc.mint(msg.sender, 100_000 * 1e6);

        console2.log("MockUSDC deployed at:", address(usdc));
        console2.log("Minted 100,000 mUSDC to:", msg.sender);

        vm.stopBroadcast();
    }
}
