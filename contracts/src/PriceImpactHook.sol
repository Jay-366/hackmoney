// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////
                            IMPORTS
//////////////////////////////////////////////////////////////*/

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";


/*//////////////////////////////////////////////////////////////
                        PRICE IMPACT HOOK
//////////////////////////////////////////////////////////////*/

contract PriceImpactHook is BaseHook {
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

    // Estimation scaling constant
    uint256 public constant ESTIMATION_K = 1e4;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    struct SwapSnapshot {
        uint160 sqrtPriceBefore;
        uint32  blockNumber;
        address trader;
    }

    // poolId => snapshot
    mapping(bytes32 => SwapSnapshot) public lastSwap;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event ImpactEstimated(
        bytes32 indexed poolId,
        address indexed trader,
        uint16 impactBps,
        uint24 feeBps
    );

    event ImpactRealized(
        bytes32 indexed poolId,
        address indexed trader,
        uint16 impactBps
    );

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    /*//////////////////////////////////////////////////////////////
                        HOOK PERMISSIONS
    //////////////////////////////////////////////////////////////*/

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory p)
    {
        p.beforeSwap = true;
        p.afterSwap  = true;
    }

    /*//////////////////////////////////////////////////////////////
                          BEFORE SWAP
    //////////////////////////////////////////////////////////////*/

    function _beforeSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata /* hookData */
    )
        internal
        override
        returns (
            bytes4,
            IPoolManager.BeforeSwapDelta memory,
            uint24 lpFeeOverride
        )
    {
        // Read pool state
        (uint160 sqrtPriceBefore,, uint128 liquidity,,,) =
            poolManager.getSlot0(key);

        require(liquidity > 0, "NO_LIQUIDITY");

        // Absolute input amount
        uint256 amountIn = params.amountSpecified > 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);

        // Estimate impact: Δx / L_active
        uint256 impactBps =
            (amountIn * ESTIMATION_K) / uint256(liquidity);

        if (impactBps > 10_000) impactBps = 10_000;

        // Fee tier selection
        if (impactBps < RETAIL_MAX_BPS) {
            lpFeeOverride = FEE_RETAIL;
        } else if (impactBps < ELEVATED_MAX_BPS) {
            lpFeeOverride = FEE_ELEVATED;
        } else if (impactBps < HIGH_MAX_BPS) {
            lpFeeOverride = FEE_HIGH;
        } else {
            lpFeeOverride = FEE_TOXIC;
        }

        // Store snapshot for afterSwap
        bytes32 poolId = keccak256(abi.encode(key));
        lastSwap[poolId] = SwapSnapshot({
            sqrtPriceBefore: sqrtPriceBefore,
            blockNumber: uint32(block.number),
            trader: sender
        });

        emit ImpactEstimated(
            poolId,
            sender,
            uint16(impactBps),
            lpFeeOverride
        );

        return (
            this.beforeSwap.selector,
            IPoolManager.BeforeSwapDelta(0, 0),
            lpFeeOverride
        );
    }

    /*//////////////////////////////////////////////////////////////
                           AFTER SWAP
    //////////////////////////////////////////////////////////////*/

    function _afterSwap(
        address,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        IPoolManager.BalanceDelta calldata,
        bytes calldata
    )
        internal
        override
        returns (bytes4, int128)
    {
        bytes32 poolId = keccak256(abi.encode(key));
        SwapSnapshot memory snap = lastSwap[poolId];

        if (snap.sqrtPriceBefore == 0) {
            return (this.afterSwap.selector, 0);
        }

        (uint160 sqrtPriceAfter,,,,,) =
            poolManager.getSlot0(key);

        uint256 diff = sqrtPriceAfter > snap.sqrtPriceBefore
            ? sqrtPriceAfter - snap.sqrtPriceBefore
            : snap.sqrtPriceBefore - sqrtPriceAfter;

        uint256 impactBps =
            (diff * 10_000) / snap.sqrtPriceBefore;

        if (impactBps > 10_000) impactBps = 10_000;

        emit ImpactRealized(
            poolId,
            snap.trader,
            uint16(impactBps)
        );

        return (this.afterSwap.selector, 0);
    }
}
