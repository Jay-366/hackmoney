// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract PoolRegistry {
    struct PoolInfo {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        uint256 createdAt;
        address creator;
    }

    mapping(bytes32 => PoolInfo) private _pools;
    bytes32[] private _poolIds;
    mapping(address => bytes32[]) private _poolIdsByHook;

    event PoolRegistered(
        bytes32 indexed poolId,
        address indexed currency0,
        address indexed currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks,
        address creator
    );

    /// @notice Matches v4 PoolManager poolId computation: keccak256(abi.encode(PoolKey))
    function computePoolId(PoolKey calldata key) public pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }

    function register(PoolKey calldata key) external returns (bytes32 poolId) {
        // unwrap types
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        address hk = address(key.hooks);

        require(c0 != c1, "SAME_TOKEN");
        require(c0 < c1, "NOT_SORTED"); // v4 expects sorted currencies

        poolId = computePoolId(key);
        require(_pools[poolId].createdAt == 0, "ALREADY_REGISTERED");

        _pools[poolId] = PoolInfo({
            currency0: c0,
            currency1: c1,
            fee: key.fee,
            tickSpacing: key.tickSpacing,
            hooks: hk,
            createdAt: block.timestamp,
            creator: msg.sender
        });

        _poolIds.push(poolId);
        _poolIdsByHook[hk].push(poolId);

        emit PoolRegistered(poolId, c0, c1, key.fee, key.tickSpacing, hk, msg.sender);
    }

    // ---- All pools ----

    function totalPools() external view returns (uint256) {
        return _poolIds.length;
    }

    function poolIdAt(uint256 index) external view returns (bytes32) {
        require(index < _poolIds.length, "OOB");
        return _poolIds[index];
    }

    function getPool(bytes32 poolId) external view returns (PoolInfo memory) {
        require(_pools[poolId].createdAt != 0, "NOT_FOUND");
        return _pools[poolId];
    }

    function listPoolIds(uint256 start, uint256 limit) external view returns (bytes32[] memory out) {
        uint256 n = _poolIds.length;
        if (start >= n) return new bytes32[](0);

        uint256 end = start + limit;
        if (end > n) end = n;

        out = new bytes32[](end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = _poolIds[i];
        }
    }

    // ---- By hook ----

    function countByHook(address hooks) external view returns (uint256) {
        return _poolIdsByHook[hooks].length;
    }

    function poolIdByHookAt(address hooks, uint256 index) external view returns (bytes32) {
        require(index < _poolIdsByHook[hooks].length, "OOB");
        return _poolIdsByHook[hooks][index];
    }

    function listPoolIdsByHook(address hooks, uint256 start, uint256 limit)
        external
        view
        returns (bytes32[] memory out)
    {
        bytes32[] storage arr = _poolIdsByHook[hooks];
        uint256 n = arr.length;
        if (start >= n) return new bytes32[](0);

        uint256 end = start + limit;
        if (end > n) end = n;

        out = new bytes32[](end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = arr[i];
        }
    }
}
