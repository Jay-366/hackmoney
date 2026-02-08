// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract PrintMockToken is Script {
    function run() external {
        uint256 amount = 1000000 * 1e6; // 1000 USDC (6 decimals)
        address deployer = 0x291F0E5392A772D79150f8be38106Dd65FccA769;

        vm.startBroadcast();

        // Mint MockUSDC
        address usdc = 0xAf6C3A632806ED83155F9F582D1C63aC31d1d435;
        MockUSDC(usdc).mint(deployer, amount);
        console2.log("Minted 1000 MockUSDC to:", deployer);
        console2.log("New USDC Balance:", MockUSDC(usdc).balanceOf(deployer));

        // MockETH (Fixed Supply)
        address eth = 0x209A45E3242a2985bA5701e07615B441FF2593c9;
        console2.log("MockETH Address:", eth);
        console2.log("MockETH Balance:", MockERC20(eth).balanceOf(deployer));
        console2.log("(MockETH is fixed supply, cannot mint more)");

        vm.stopBroadcast();
    }
}
