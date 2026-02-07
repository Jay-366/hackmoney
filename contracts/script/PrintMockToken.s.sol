// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/MockERC20.sol";

contract PrintMockToken is Script {
    function run() external view {
        // 🔁 replace with your deployed token address
        address tokenAddress = 0x6F89Cd685215188050e05d57456c16d0c9EdD354;
        //;
        //0x6f8020Bd22913F46fe60d6A3330A4B4E7fB13aEB;

        // address you want to inspect
        address user = 0x291F0E5392A772D79150f8be38106Dd65FccA769;

        MockERC20 token = MockERC20(tokenAddress);

        console2.log("Token address:", tokenAddress);
        console2.log("Name:", token.name());
        console2.log("Symbol:", token.symbol());
        console2.log("Decimals:", token.decimals());
        console2.log("Total supply:", token.totalSupply());
        console2.log("User balance:", token.balanceOf(user));
    }
}
