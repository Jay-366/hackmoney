// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

// Interface to the 8004 Identity Registry
interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

contract AminoReputationRegistry is Ownable {
    // --- STANDARD ERC-8004 EVENT (REQUIRED FOR 8004SCAN) ---
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    // --- Custom Events ---
    event ReputationUpdated(uint256 indexed agentId, int128 newScore);
    event BondDeposited(uint256 indexed agentId, uint256 amount);
    event BondSlashed(uint256 indexed agentId, uint256 amount, string reason);

    // --- State ---
    mapping(uint256 => int128) public reputationScores; // AgentID -> Score (0-100)
    mapping(uint256 => uint256) public agentBonds; // AgentID -> Bond (wei)

    address public aminoHook;
    IIdentityRegistry public identityRegistry;

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    function setHookAddress(address _hook) external onlyOwner {
        aminoHook = _hook;
    }

    // --- The Bank: Deposit Bond ---
    function depositBond(uint256 agentId) external payable {
        require(msg.value > 0, "Must deposit ETH");
        agentBonds[agentId] += msg.value;
        emit BondDeposited(agentId, msg.value);
    }

    // --- The Enforcer: Slash Bond ---
    function slash(
        uint256 agentId,
        uint256 amount,
        string calldata reason
    ) external {
        require(msg.sender == aminoHook, "Only Hook can slash");
        require(agentBonds[agentId] >= amount, "Insufficient bond");

        agentBonds[agentId] -= amount;

        // Burn/Confiscate funds
        payable(owner()).transfer(amount);

        // Nuke score locally
        reputationScores[agentId] = 0;

        emit BondSlashed(agentId, amount, reason);
        emit ReputationUpdated(agentId, 0);

        // 🟢 EMIT STANDARD EVENT FOR EXPLORER
        // "value: 0" tells the explorer the reputation is destroyed
        emit NewFeedback(
            agentId,
            msg.sender, // The Hook is the "reviewer"
            0, // Index (optional)
            0, // Value (Score = 0)
            0, // Decimals
            "slashed",
            "slashed",
            "",
            "",
            "",
            bytes32(0)
        );
    }

    // --- The Judge: Update Score ---
    function updateScore(uint256 agentId, int128 newScore) external {
        require(msg.sender == aminoHook, "Only Hook can update");

        if (newScore > 100) newScore = 100;
        if (newScore < 0) newScore = 0;

        reputationScores[agentId] = newScore;
        emit ReputationUpdated(agentId, newScore);

        // 🟢 EMIT STANDARD EVENT FOR EXPLORER
        emit NewFeedback(
            agentId,
            msg.sender,
            0,
            newScore, // The new score
            0,
            "hook_update",
            "hook_update",
            "",
            "",
            "",
            bytes32(0)
        );
    }

    // View for Hook
    function getSummary(
        uint256 agentId
    ) external view returns (int128 score, uint256 bond) {
        return (reputationScores[agentId], agentBonds[agentId]);
    }
}
