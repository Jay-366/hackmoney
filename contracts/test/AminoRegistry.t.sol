// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AminoReputationRegistry.sol";
import "../src/AminoValidationRegistry.sol";

// Mock the Identity Registry (Passport Office) so we don't need the real one
contract MockIdentityRegistry {
    function ownerOf(uint256 agentId) external pure returns (address) {
        // Assume Agent #1 is owned by address(0x123)
        if (agentId == 1) return address(0x123);
        return address(0);
    }
}

contract AminoRegistryTest is Test {
    AminoReputationRegistry reputation;
    AminoValidationRegistry validation;
    MockIdentityRegistry identity;

    address owner = address(this);
    address hook = address(0x999); // We pretend this address is the Uniswap Hook
    address agentOwner = address(0x123);
    uint256 agentId = 1;

    // Setup runs before every test
    function setUp() public {
        // 1. Deploy Mocks & Contracts
        identity = new MockIdentityRegistry();
        reputation = new AminoReputationRegistry(address(identity));
        validation = new AminoValidationRegistry();

        // 2. Authorize the Hook (Critical Step!)
        reputation.setHookAddress(hook);
    }

    // Allow the test contract to receive ETH
    receive() external payable {}

    // --- TEST 1: The Deposit ---
    function test_DepositBond() public {
        // User sends 1 ETH to the Bank
        vm.deal(agentOwner, 10 ether); // Give fake ETH to user
        vm.prank(agentOwner); // Pretend to be the user

        reputation.depositBond{value: 1 ether}(agentId);

        // Check the ledger
        (int128 score, uint256 bond) = reputation.getSummary(agentId);
        assertEq(bond, 1 ether);
        assertEq(score, 0); // Score starts at 0
    }

    // --- TEST 2: The Hook Updates Score ---
    function test_UpdateScore() public {
        // Pretend to be the Hook
        vm.prank(hook);

        reputation.updateScore(agentId, 85);

        (int128 score, ) = reputation.getSummary(agentId);
        assertEq(score, 85);
    }

    // --- TEST 3: Security Check (Random User can't Slash) ---
    function test_FailSlash_IfNotHook() public {
        // Deposit first
        reputation.depositBond{value: 1 ether}(agentId);

        // Random user tries to slash
        vm.prank(address(0xBEEF));

        // This EXPECTS a revert
        vm.expectRevert("Only Hook can slash");
        reputation.slash(agentId, 0.5 ether, "Hehe");
    }

    // --- TEST 4: The Slash (The Main Event) ---
    function test_SlashLogic() public {
        // 1. Setup: Deposit 1 ETH & Give Score 100
        reputation.depositBond{value: 1 ether}(agentId);
        vm.prank(hook);
        reputation.updateScore(agentId, 100);

        // 2. The Crime: Hook Slashes 0.1 ETH
        uint256 slashAmount = 0.1 ether;
        uint256 ownerBalanceBefore = address(this).balance;

        vm.prank(hook);
        reputation.slash(agentId, slashAmount, "Toxic Trade Detected");

        // 3. The Aftermath
        (int128 score, uint256 bond) = reputation.getSummary(agentId);

        // Check Bond: Should be 0.9 ETH
        assertEq(bond, 0.9 ether);

        // Check Score: Should be nuked to 0
        assertEq(score, 0);

        // Check Money Flow: Did the slashed ETH go to the protocol owner?
        assertEq(address(this).balance, ownerBalanceBefore + slashAmount);
    }

    // --- TEST 5: Validation Mock ---
    function test_ValidationAlwaysTrue() public view {
        bool result = validation.validateTrade("0x", new uint256[](0));
        assertTrue(result);
    }
}
