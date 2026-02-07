// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";

contract DeployMockTokens is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 tokenA = new MockERC20("SepoliaETH", "ETH", 1_000_000 ether);

        console2.log("Mock SepoliaETH deployed at:", address(tokenA));

        vm.stopBroadcast();
    }
}
