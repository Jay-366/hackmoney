// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";

contract DeployMockTokens is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 tokenA = new MockERC20("Mock Token A", "MTKA", 1_000_000 ether);
        MockERC20 tokenB = new MockERC20("Mock Token B", "MTKB", 1_000_000 ether);

        console2.log("Mock ERC20 A deployed at:", address(tokenA));
        console2.log("Mock ERC20 B deployed at:", address(tokenB));

        vm.stopBroadcast();
    }
}
