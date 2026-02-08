// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "../lib/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

// --------------------
// Interfaces
// --------------------
interface IAminoReputationRegistry {
    function identityRegistry() external view returns (IIdentityRegistry);
    function getSummary(uint256 agentId) external view returns (int128 score, uint256 bond);
    function slash(uint256 agentId, uint256 amount, string calldata reason) external;
}

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

contract AminoRiskFeeHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    // --------------------
    // Config
    // --------------------
    address public owner;
    IAminoReputationRegistry public registry; // set later
    address public constant UR = 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b;

    uint256 public constant MIN_BOND_WEI = 0.05 ether;

    // Fee tiers (in Uniswap V4 units: hundredths of basis points)
    // 1 bps = 100 units, so 0.05% = 5 bps = 500 units
    uint24 public constant FEE_PARTNER = 500;  // 0.05% (5 bps)
    uint24 public constant FEE_RETAIL = 3000;  // 0.30% (30 bps)
    uint24 public constant FEE_ELEV = 6000;    // 0.60% (60 bps)
    uint24 public constant FEE_TOXIC = 15000;  // 1.50% (150 bps)

    // Risk thresholds
    // R in [0, 1e18] (1e18 == 1.0)
    uint256 public constant R_PARTNER_MAX = 1e17; // 0.1
    uint256 public constant R_RETAIL_MAX = 3e17; // 0.3
    uint256 public constant R_ELEV_MAX = 7e17; // 0.7

    // Weights for combining metrics (tunable)
    // R_now = wI*I + wS*S  (ρ handled later)
    uint256 public constant W_I = 6e17; // 0.6
    uint256 public constant W_S = 4e17; // 0.4

    // markout delay
    uint256 public constant MARKOUT_DELAY_BLOCKS = 10;

    // --------------------
    // Storage for markout
    // --------------------
    struct SwapRecord {
        PoolId poolId;
        address sender;
        uint256 agentId;
        uint256 blockNumber;
        uint160 sqrtPriceBeforeX96;
        uint160 sqrtPriceAfterX96;
    }

    mapping(bytes32 => SwapRecord) public swaps;
    mapping(PoolId => uint256) public poolNonces;

    event RegistrySet(address indexed registry);
    event SwapRecorded(
        bytes32 indexed swapId,
        PoolId indexed poolId,
        address indexed sender,
        uint256 agentId,
        uint160 sqrtPriceBeforeX96,
        uint160 sqrtPriceAfterX96,
        uint24 feeBps,
        uint256 Rnow
    );
    event MarkoutChecked(bytes32 indexed swapId, uint256 rho1e18);

    error NotOwner();
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IPoolManager _poolManager, address _owner) BaseHook(_poolManager) {
        owner = _owner;
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = IAminoReputationRegistry(_registry);
        emit RegistrySet(_registry);
    }

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory p)
    {
        p.beforeSwap = true;
        p.afterSwap = true;
        // markout is not a hook callback; it’s a public function on this hook.
    }

    // ============================================================
    // Core: beforeSwap decides the fee
    // ============================================================
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Decode agentId + proof (proof ignored now)
        uint256 agentId = 0;
        if (hookData.length > 0) {
            (agentId, ) = abi.decode(hookData, (uint256, bytes));
        }

        PoolId poolId = key.toId();

        // Read current pool state
        (uint160 sqrtPriceBeforeX96, , , ) = _getSlot0(poolId);

        uint256 nextNonce = poolNonces[poolId] + 1;
        _tempBefore[poolId][nextNonce] = sqrtPriceBeforeX96;
        poolNonces[poolId] = nextNonce;

        // Estimate metrics using pre-swap info
        uint256 I1e18 = _estimatePriceImpact1e18(sqrtPriceBeforeX96, params);
        uint256 S1e18 = _estimateLiquidityStress1e18(poolId, params);

        // Combine into R_now (ρ later)
        uint256 Rnow = (W_I * I1e18 + W_S * S1e18) / 1e18;
        if (Rnow > 1e18) Rnow = 1e18;

        // Determine “Partner” eligibility (bonded + sender-binding)
        bool partnerEligible = false;
        if (address(registry) != address(0) && agentId != 0) {
            try registry.getSummary(agentId) returns (int128, uint256 bond) {
                if (bond >= MIN_BOND_WEI) {
                    try registry.identityRegistry().ownerOf(agentId) returns (address controller) {
                        if (controller == sender || sender == UR) {
                            partnerEligible = true;
                        }
                    } catch {}
                }
            } catch {}
        }

        // Fee tiering
        uint24 feeBps;
        if (partnerEligible && Rnow < R_PARTNER_MAX) {
            feeBps = FEE_PARTNER;
        } else if (Rnow < R_RETAIL_MAX) {
            feeBps = FEE_RETAIL;
        } else if (Rnow < R_ELEV_MAX) {
            feeBps = FEE_ELEV;
        } else {
            feeBps = FEE_TOXIC;
        }
        
        // Store for event emission
        _tempData[poolId][nextNonce] = SwapTemp({feeBps: feeBps, Rnow: Rnow});

        // Apply dynamic fee override with OVERRIDE_FEE_FLAG
        uint24 lpFeeOverride = feeBps | LPFeeLibrary.OVERRIDE_FEE_FLAG;
        
        return (
            BaseHook.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            lpFeeOverride
        );
    }

    // ============================================================
    // afterSwap records state for markout (ρ)
    // ============================================================
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata /*params*/,
        BalanceDelta /*delta*/,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        uint256 agentId = 0;
        if (hookData.length > 0) {
            (agentId, ) = abi.decode(hookData, (uint256, bytes));
        }

        PoolId poolId = key.toId();

        // nonce used for swapId = current nonce (after increment in beforeSwap)
        uint256 nonce = poolNonces[poolId];

        // Read prices
        (uint160 sqrtPriceAfterX96, , , ) = _getSlot0(poolId);

        // Retrieve stored "before" price
        uint160 sqrtPriceBeforeX96 = _tempBefore[poolId][nonce];

        bytes32 swapId = keccak256(
            abi.encodePacked(poolId, sender, agentId, block.number, nonce)
        );

        swaps[swapId] = SwapRecord({
            poolId: poolId,
            sender: sender,
            agentId: agentId,
            blockNumber: block.number,
            sqrtPriceBeforeX96: sqrtPriceBeforeX96,
            sqrtPriceAfterX96: sqrtPriceAfterX96
        });

        SwapTemp memory t = _tempData[poolId][nonce];
        delete _tempData[poolId][nonce]; // clear transient data

        emit SwapRecorded(
            swapId,
            poolId,
            sender,
            agentId,
            sqrtPriceBeforeX96,
            sqrtPriceAfterX96,
            t.feeBps,
            t.Rnow
        );

        return (BaseHook.afterSwap.selector, 0);
    }

    // ============================================================
    // Markout verifier (ρ), called later
    // ============================================================
    function verifyMarkout(bytes32 swapId) external returns (uint256 rho1e18) {
        SwapRecord memory r = swaps[swapId];
        require(r.blockNumber != 0, "UNKNOWN_SWAP");
        require(
            block.number >= r.blockNumber + MARKOUT_DELAY_BLOCKS,
            "TOO_EARLY"
        );

        (uint160 sqrtNowX96, , , ) = _getSlot0(r.poolId);

        // ρ = |P_{t+10} - P_t| / |P_t - P_before|
        uint256 num = _absDiff(r.sqrtPriceAfterX96, sqrtNowX96);
        uint256 den = _absDiff(r.sqrtPriceBeforeX96, r.sqrtPriceAfterX96);
        if (den == 0) return 1e18; // no movement
        
        rho1e18 = (num * 1e18) / den;
        if (rho1e18 > 1e18) rho1e18 = 1e18;

        emit MarkoutChecked(swapId, rho1e18);

        // Only slash if registry is set
        if (
            rho1e18 < 2e17 && address(registry) != address(0) && r.agentId != 0
        ) {
            registry.slash(r.agentId, 0.01 ether, "toxic flow detected");
        }
    }

    // ============================================================
    // Temp storage to capture before price per (poolId, nonce)
    // ============================================================
    // ============================================================
    // Temp storage
    // ============================================================
    struct SwapTemp {
        uint24 feeBps;
        uint256 Rnow;
    }
    mapping(PoolId => mapping(uint256 => uint160)) internal _tempBefore;
    mapping(PoolId => mapping(uint256 => SwapTemp)) internal _tempData;

    // ============================================================
    // Metric estimation (MVP approximations)
    // ============================================================

    function _estimatePriceImpact1e18(
        uint160 /*sqrtPriceBeforeX96*/,
        SwapParams calldata params
    ) internal pure returns (uint256) {
        uint256 amt = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        uint256 K = 1e20;
        uint256 impact = (amt * 1e18) / (amt + K);
        if (impact > 1e18) impact = 1e18;
        return impact;
    }

    function _estimateLiquidityStress1e18(
        PoolId poolId,
        SwapParams calldata params
    ) internal view returns (uint256) {
        uint128 L = _getLiquidity(poolId);
        if (L == 0) return 0;

        uint256 dx = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        uint256 stress = (dx * 1e18) / uint256(L);
        if (stress > 1e18) stress = 1e18;
        return stress;
    }

    // ============================================================
    // PoolManager state reads (low-level)
    // ============================================================

    function _getSlot0(
        PoolId poolId
    )
        internal
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint24 protocolFee,
            uint24 lpFee
        )
    {
        return poolManager.getSlot0(poolId);
    }

    function _getLiquidity(PoolId poolId) internal view returns (uint128 L) {
        return poolManager.getLiquidity(poolId);
    }

    // ============================================================
    // Utils
    // ============================================================

    function _absDiff(uint160 a, uint160 b) internal pure returns (uint256) {
        return a >= b ? uint256(a - b) : uint256(b - a);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}