// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

/// @notice Metric A only: override fee based on estimated price impact.
/// - beforeSwap: estimate impact => choose fee
/// - afterSwap: compute realized impact (sqrt price movement) => emit event
contract PriceImpactHook is BaseHook {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    /*//////////////////////////////////////////////////////////////
                                CONFIG
    //////////////////////////////////////////////////////////////*/

    // Impact thresholds (basis points)
    uint16 public constant RETAIL_MAX_BPS   = 100; // <1%
    uint16 public constant ELEVATED_MAX_BPS = 300; // <3%
    uint16 public constant HIGH_MAX_BPS     = 700; // <7%

    // Fee overrides (basis points)
    uint24 public constant FEE_RETAIL   = 30;
    uint24 public constant FEE_ELEVATED = 60;
    uint24 public constant FEE_HIGH     = 150;
    uint24 public constant FEE_TOXIC    = 200;

    // Estimation scaling constant:
    // impactEstBps ~= amountAbs * ESTIMATION_K / liquidity
    uint256 public constant ESTIMATION_K = 1e4;

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    struct SwapSnapshot {
        uint160 sqrtPriceBefore;
        address trader;
    }

    // poolId => snapshot
    mapping(bytes32 => SwapSnapshot) public lastSwap;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event ImpactEstimated(PoolId indexed poolId, address indexed trader, uint16 impactBps, uint24 feeBps);
    event ImpactRealized(PoolId indexed poolId, address indexed trader, uint16 impactBps);

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _absAmount(int256 amountSpecified) internal pure returns (uint256) {
        return amountSpecified >= 0 ? uint256(amountSpecified) : uint256(-amountSpecified);
    }

    function _selectFee(uint256 impactBps) internal pure returns (uint24) {
        if (impactBps < RETAIL_MAX_BPS) return FEE_RETAIL;
        if (impactBps < ELEVATED_MAX_BPS) return FEE_ELEVATED;
        if (impactBps < HIGH_MAX_BPS) return FEE_HIGH;
        return FEE_TOXIC;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK: BEFORE SWAP
    //////////////////////////////////////////////////////////////*/

    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata /* hookData */
    )
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24 lpFeeOverride)
    {
        PoolId poolId = key.toId();

        // Read sqrtPrice and liquidity via StateLibrary
        (uint160 sqrtPriceBefore,,,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        require(liquidity > 0, "NO_LIQUIDITY");

        // Estimate impact using |amountSpecified| / liquidity
        uint256 amountAbs = _absAmount(params.amountSpecified);
        uint256 impactBps = (amountAbs * ESTIMATION_K) / uint256(liquidity);
        if (impactBps > 10_000) impactBps = 10_000;

        lpFeeOverride = _selectFee(impactBps);

        // Snapshot for realized impact
        lastSwap[PoolId.unwrap(poolId)] = SwapSnapshot({sqrtPriceBefore: sqrtPriceBefore, trader: sender});

        emit ImpactEstimated(poolId, sender, uint16(impactBps), lpFeeOverride);

        // No delta change; only fee override
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, lpFeeOverride);
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK: AFTER SWAP
    //////////////////////////////////////////////////////////////*/

    function _afterSwap(
        address /* sender */,
        PoolKey calldata key,
        SwapParams calldata /* params */,
        BalanceDelta /* delta */,
        bytes calldata /* hookData */
    )
        internal
        override
        returns (bytes4, int128)
    {
        PoolId poolId = key.toId();
        SwapSnapshot memory snap = lastSwap[PoolId.unwrap(poolId)];

        if (snap.sqrtPriceBefore == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }

        (uint160 sqrtPriceAfter,,,) = poolManager.getSlot0(poolId);

        uint256 diff = sqrtPriceAfter > snap.sqrtPriceBefore
            ? uint256(sqrtPriceAfter - snap.sqrtPriceBefore)
            : uint256(snap.sqrtPriceBefore - sqrtPriceAfter);

        // realized impact in sqrt-price space (bps)
        uint256 impactBps = (diff * 10_000) / uint256(snap.sqrtPriceBefore);
        if (impactBps > 10_000) impactBps = 10_000;

        emit ImpactRealized(poolId, snap.trader, uint16(impactBps));

        // no hook delta
        return (BaseHook.afterSwap.selector, 0);
    }
}
