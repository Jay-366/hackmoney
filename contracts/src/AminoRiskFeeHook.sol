// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseHook} from "../lib/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// Optional registry you’ll plug later (sender binding + bond).
interface IAgentRegistry {
    function agentController(uint256 agentId) external view returns (address);
    function agentBonds(uint256 agentId) external view returns (uint256);
}

contract AminoRiskFeeHook is BaseHook {
    // --------------------
    // Config
    // --------------------
    address public owner;
    IAgentRegistry public registry; // set later

    uint256 public constant MIN_BOND_WEI = 0.05 ether;

    // Fee tiers (bps)
    uint24 public constant FEE_PARTNER = 5;    // 0.05%
    uint24 public constant FEE_RETAIL  = 30;   // 0.30%
    uint24 public constant FEE_ELEV    = 60;   // 0.60%
    uint24 public constant FEE_TOXIC   = 150;  // 1.50%

    // Risk thresholds
    // R in [0, 1e18] (1e18 == 1.0)
    uint256 public constant R_PARTNER_MAX = 1e17; // 0.1
    uint256 public constant R_RETAIL_MAX  = 3e17; // 0.3
    uint256 public constant R_ELEV_MAX    = 7e17; // 0.7

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
        bytes32 poolId;
        address sender;
        uint256 agentId;
        uint256 blockNumber;
        uint160 sqrtPriceBeforeX96;
        uint160 sqrtPriceAfterX96;
        // you can store more later (amountIn, etc.)
    }

    mapping(bytes32 => SwapRecord) public swaps;
    mapping(bytes32 => uint256) public poolNonces;

    event RegistrySet(address indexed registry);
    event SwapRecorded(
        bytes32 indexed swapId,
        bytes32 indexed poolId,
        address indexed sender,
        uint256 agentId,
        uint160 sqrtPriceBeforeX96,
        uint160 sqrtPriceAfterX96,
        uint24 feeBps,
        uint256 Rnow
    );
    event MarkoutChecked(
        bytes32 indexed swapId,
        uint256 rho1e18
    );

    error NotOwner();
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {
        owner = msg.sender;
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = IAgentRegistry(_registry);
        emit RegistrySet(_registry);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory p) {
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
    )
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // Decode agentId + proof (proof ignored now)
        uint256 agentId = 0;
        if (hookData.length > 0) {
            (agentId, ) = abi.decode(hookData, (uint256, bytes));
        }

        bytes32 poolId = keccak256(abi.encode(key));

        // Read current pool state
        (uint160 sqrtPriceBeforeX96,,,) = _getSlot0(poolId);

        // Estimate metrics using pre-swap info
        uint256 I1e18 = _estimatePriceImpact1e18(sqrtPriceBeforeX96, params);
        uint256 S1e18 = _estimateLiquidityStress1e18(poolId, params);

        // Combine into R_now (ρ later)
        uint256 Rnow = (W_I * I1e18 + W_S * S1e18) / 1e18;
        if (Rnow > 1e18) Rnow = 1e18;

        // Determine “Partner” eligibility (bonded + sender-binding)
        bool partnerEligible = false;
        if (address(registry) != address(0) && agentId != 0) {
            address controller = registry.agentController(agentId);
            uint256 bond = registry.agentBonds(agentId);
            if (controller == sender && bond >= MIN_BOND_WEI) {
                partnerEligible = true;
            }
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

        // Generate swapId now (so we can store record in afterSwap)
        // Store temporarily in memory via event only is not enough; we store in afterSwap.
        // We’ll regenerate the same swapId in afterSwap using the same nonce logic:
        // (poolId, sender, agentId, block.number, nonce)
        // To do that, we increment nonce here.
        poolNonces[poolId]++;

        // No balance delta changes, only fee override
        return (this.beforeSwap.selector, BeforeSwapDelta.wrap(0), feeBps);
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
    )
        internal
        override
        returns (bytes4, int128)
    {
        uint256 agentId = 0;
        if (hookData.length > 0) {
            (agentId, ) = abi.decode(hookData, (uint256, bytes));
        }

        bytes32 poolId = keccak256(abi.encode(key));

        // nonce used for swapId = current nonce (after increment in beforeSwap)
        uint256 nonce = poolNonces[poolId];

        // Read prices
        (uint160 sqrtPriceAfterX96,,,) = _getSlot0(poolId);

        // We don’t have sqrtPriceBefore here unless we re-read it earlier.
        // For now, we store "before" as "after" for safety if missed.
        // Better: also record sqrtPriceBefore in beforeSwap into a temp mapping keyed by (poolId, nonce).
        // We'll do that with temp mapping:
        uint160 sqrtPriceBeforeX96 = _tempBefore[poolId][nonce];

        bytes32 swapId = keccak256(abi.encodePacked(poolId, sender, agentId, block.number, nonce));

        swaps[swapId] = SwapRecord({
            poolId: poolId,
            sender: sender,
            agentId: agentId,
            blockNumber: block.number,
            sqrtPriceBeforeX96: sqrtPriceBeforeX96,
            sqrtPriceAfterX96: sqrtPriceAfterX96
        });

        emit SwapRecorded(
            swapId,
            poolId,
            sender,
            agentId,
            sqrtPriceBeforeX96,
            sqrtPriceAfterX96,
            0, // feeBps not passed here; you can emit it via temp mapping too if you want
            0  // Rnow not passed here; you can emit it via temp mapping too
        );

        return (this.afterSwap.selector, 0);
    }

    // ============================================================
    // Markout verifier (ρ), called later
    // ============================================================
    function verifyMarkout(bytes32 swapId) external returns (uint256 rho1e18) {
        SwapRecord memory r = swaps[swapId];
        require(r.blockNumber != 0, "UNKNOWN_SWAP");
        require(block.number >= r.blockNumber + MARKOUT_DELAY_BLOCKS, "TOO_EARLY");

        (uint160 sqrtNowX96,,,) = _getSlot0(r.poolId);

        // ρ = |P_{t+10} - P_t| / |P_t - P_before|
        // We use sqrtPrice as a proxy for price to keep it cheap; ratio still meaningful.
        uint256 num = _absDiff(r.sqrtPriceAfterX96, sqrtNowX96);
        uint256 den = _absDiff(r.sqrtPriceBeforeX96, r.sqrtPriceAfterX96);
        if (den == 0) return 1e18; // no movement -> treat as fully reversible

        rho1e18 = (num * 1e18) / den;
        if (rho1e18 > 1e18) rho1e18 = 1e18;

        emit MarkoutChecked(swapId, rho1e18);

        // Later: use rho to slash/update score in registry
        // e.g. if rho < 0.2e18 => toxic -> slash( agentId, ... )
    }

    // ============================================================
    // Temp storage to capture before price per (poolId, nonce)
    // ============================================================
    mapping(bytes32 => mapping(uint256 => uint160)) internal _tempBefore;

    // We must capture sqrtPriceBefore inside beforeSwap, so add this helper:
    // Call this at the start of beforeSwap after reading slot0:
    // _tempBefore[poolId][poolNonces[poolId]+1] = sqrtPriceBeforeX96;
    //
    // To keep code simple above, implement as internal used by beforeSwap:
    function _captureBefore(bytes32 poolId, uint256 nextNonce, uint160 sqrtPriceBeforeX96) internal {
        _tempBefore[poolId][nextNonce] = sqrtPriceBeforeX96;
    }

    // ============================================================
    // Metric estimation (MVP approximations)
    // ============================================================

    /// Price impact estimate in [0,1e18].
    /// MVP: uses a rough proxy from amountSpecified magnitude.
    /// Replace later with real simulation (SwapMath) if you want higher fidelity.
    function _estimatePriceImpact1e18(
        uint160 /*sqrtPriceBeforeX96*/,
        SwapParams calldata params
    ) internal pure returns (uint256) {
        // params.amountSpecified is int256, negative means exact output in some flows.
        // For MVP, use abs(amount) scaled into a tiny value; you should replace this later.
        uint256 amt = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        // Simple saturating curve: impact ~ amt / (amt + K)
        // Choose K large so typical trades are low impact.
        uint256 K = 1e20;
        uint256 impact = (amt * 1e18) / (amt + K);
        if (impact > 1e18) impact = 1e18;
        return impact;
    }

    /// Liquidity stress S = Δx / L_active.
    /// MVP: uses pool liquidity from PoolManager if available; otherwise returns 0.
    function _estimateLiquidityStress1e18(
        bytes32 poolId,
        SwapParams calldata params
    ) internal view returns (uint256) {
        uint128 L = _getLiquidity(poolId);
        if (L == 0) return 0;

        uint256 dx = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        // scale: dx / L
        // Note: units don’t match perfectly; for MVP it behaves as a stress proxy.
        uint256 stress = (dx * 1e18) / uint256(L);
        if (stress > 1e18) stress = 1e18;
        return stress;
    }

    // ============================================================
    // PoolManager state reads (low-level)
    // ============================================================

    function _getSlot0(bytes32 poolId) internal view returns (uint160 sqrtPriceX96, int24 tick, uint16 obsCard, uint8 feeProtocol) {
        // selector: getSlot0(bytes32)
        (bool ok, bytes memory data) = address(poolManager).staticcall(
            abi.encodeWithSignature("getSlot0(bytes32)", poolId)
        );
        require(ok && data.length >= 32, "SLOT0_UNAVAILABLE");
        (sqrtPriceX96, tick, obsCard, feeProtocol) = abi.decode(data, (uint160, int24, uint16, uint8));
    }

    function _getLiquidity(bytes32 poolId) internal view returns (uint128 L) {
        // selector: getLiquidity(bytes32)
        (bool ok, bytes memory data) = address(poolManager).staticcall(
            abi.encodeWithSignature("getLiquidity(bytes32)", poolId)
        );
        if (!ok || data.length < 32) return 0;
        (L) = abi.decode(data, (uint128));
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
