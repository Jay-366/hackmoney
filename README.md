# AMINOHOOKS 

### 🧬 The Immune System of DeFi

![Status](https://img.shields.io/badge/Status-Development-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Uniswap](https://img.shields.io/badge/Uniswap-v4-ff007a)
![Foundry](https://img.shields.io/badge/Built%20With-Foundry-orange)

**Bonded-Risk Execution** is a next-generation liquidity protection layer that transforms Uniswap v4 from a passive AMM into an **agent-aware risk market**.

By combining **ERC-8004 Agent Identity**, **ZK-Proof Compliance**, and **Dynamic Hook-based Fees**, we eliminate the "LVR Subsidy" where Liquidity Providers (LPs) lose value to toxic arbitrage and adversarial flow.

---

## 💡 Why did we build AminoHooks?

Current AMM designs treat all capital flow as equal. Whether you are a retail user swapping $50 or a sophisticated HFT bot extracting $50,000 via **Toxic Arbitrage**, the pool treats you the same.

This is a **fundamental market failure**. LPs are forced to subsidize the profits of the very bots that drain them. We realized that for the "Agentic Economy" to succeed on-chain, pools need an **Immune System**.

AminoHooks provides the "Amino Acids"—the building blocks of trust—that allow pools to:

*   🔍 **Differentiate** between "Informed/Toxic" flow and "Noise/Retail" flow.
*   ⚖️ **Enforce** economic consequences for liquidity exhaustion.
*   🏆 **Reward** transparency and long-term reputation without compromising trader privacy.

---

## 🔴 The Problem: The "Passive LP" Victim

In traditional AMMs, LPs are "passive victims." They must trade with anyone at the same price, making them vulnerable to:

*   **Toxic Flow:** Informed traders (bots) who extract value from LPs when the pool price lags behind the global market.
*   **Loss-Versus-Rebalancing (LVR):** The quantifiable cost LPs pay to arbitrageurs because they cannot adjust prices as fast as the market.
*   **Anonymity Risk:** On-chain, a harmless retail swapper and a sophisticated laundering bot look identical, forcing LPs to charge a "one-size-fits-all" fee.

---

## 🟢 The Solution: "Risk-Adjusted Execution"

This project introduces a **"Driver’s License for DeFi"** using a three-pillar approach:

1.  **ERC-8004 Identity:** Agents register an on-chain identity (with ENS-style names) and post a **collateral bond**.
2.  **ZK-Compliance:** Agents use Zero-Knowledge proofs to prove their trade respects "Safe-Flow" constraints without revealing their private trading strategies.
3.  **Dynamic Hook-based Fees:** A Uniswap v4 hook calculates **LP Stress** in real-time. Bonded/Verified agents get a "Partner Rate," while anonymous or high-risk actors pay a "Risk Surcharge."

---

## 🛠 Tech Stack

*   **Core Protocol:** Uniswap v4 (Singleton Architecture)
*   **Identity Standard:** ERC-8004 (Standard for Agentic Ethereum)
*   **Privacy:** Circom + SnarkJS (Groth16 ZK-SNARKs)
*   **Network:** Sepolia Testnet
*   **Development:** Foundry (Forge/Anvil)

---

## 📊 Risk Logic & Mathematical Framework

The system calculates a **Total Risk Score ($R_{total}$)** for every swap using three core metrics.

### 1. The Formulas

#### **Metric A: Price Impact ($I$)**
Measures the mechanical slippage caused by the trade relative to the pool size.

$$
I = \frac{|P_{after} - P_{before}|}{P_{before}}
$$

#### **Metric B: Liquidity Stress ($S$)**
Measures how much of the "active" liquidity ($L$) is being exhausted by the trade volume ($\Delta x$).

$$
S = \frac{\Delta x}{L_{active}}
$$

#### **Metric C: Reversibility Coefficient ($\rho$)**
Used for post-trade verification (The "Markout" test).

$$
\rho = \frac{|P_{t+10} - P_{t}|}{|P_{t} - P_{before}|}
$$

*   **Low $\rho$ ($\approx 0$):** Price never returned. This proves **Toxic Flow** (Informed Arb).
*   **High $\rho$ ($\approx 1$):** Price returned to equilibrium. This was **Noise Flow** (Retail).

### 2. Fee Classification Table

The Uniswap v4 hook overrides the pool fee based on the following tiers:

| Tier | Risk Score ($R$) | Agent Type | Fee (Basis Points) | Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Partner** | $< 0.1$ | Bonded + ZK Proof | **5 bps (0.05%)** | Lowest fee; Bond acts as insurance. |
| **Retail** | $0.1 - 0.3$ | Standard User | **30 bps (0.30%)** | Normal swap behavior. |
| **Elevated** | $0.3 - 0.7$ | Anonymous Bot | **60 bps (0.60%)** | Surcharge for pool stress. |
| **Toxic** | $> 0.7$ | High-Impact Arb | **150+ bps (1.5%+)** | Deterrent for pool exhaustion. |

---

## 🧩 Component Architecture

### 1. ERC-8004 Registry (The Passport)
Each agent is assigned a **Protocol Data Record (PDR)**:
*   **AgentName:** Human-readable handle (e.g., `arb-master.agent`).
*   **BondAmount:** Locked Sepolia ETH acting as collateral.
*   **ConstraintHash:** A commitment to the ZK-verified boundaries (e.g., "Max 1% impact").
*   **Slashing:** If the `afterSwap` check detects a violation or zero reversibility, the registry slashes the bond to compensate LPs.

### 2. The Uniswap v4 Hook (The Enforcer)
Interposing the `beforeSwap` and `afterSwap` lifecycle:
*   **Identification:** Resolves `msg.sender` to an ERC-8004 Agent Name.
*   **Verification:** Validates the ZK-Proof provided in `hookData`.
*   **Fee Adjustment:** Dynamically sets the `LPFee` based on the Risk Score and Agent Status.

### 3. ZK Proof (The Shield)
Using **Circom**, we prove compliance without leaking alpha:
*   **Private Inputs:** Exact trade size, internal routing, and expected price.
*   **Public Inputs:** Current pool `sqrtPrice`, Max Impact threshold.
*   **Reason:** Prevents "Strategy Leakage" while ensuring "LP Safety."

---

## 🧩 Architechture Diagram

<img width="1920" height="1080" alt="Black And White Space Bold Pitch Deck Presentation (2)" src="https://github.com/user-attachments/assets/27ceb07e-0f16-407b-b998-485c6dfbaee9" />

---

## � Getting Started

### Prerequisites

Make sure you have the following installed:

- [Bun](https://bun.sh/) (JavaScript runtime & package manager)
- [Foundry](https://github.com/foundry-rs/foundry) (Solidity development toolchain)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/hackmoney.git
cd hackmoney
```

### 2. Install Frontend Dependencies

```bash
bun install
```

### 3. Install Smart Contract Dependencies

Navigate to the contracts folder and install Foundry dependencies:

```bash
cd contracts
forge install
```

This will install the following Uniswap v4 and Foundry dependencies:
- `forge-std` - Foundry standard library
- `v4-core` - Uniswap v4 core contracts
- `v4-periphery` - Uniswap v4 periphery contracts
- `v4-template` - Uniswap v4 hook template

### 4. Install Test Agent Dependencies (Optional)

If you want to run the AI agent:

```bash
cd test-agent
bun install
```

### 5. Environment Setup

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

Required environment variables:
```
ZERODEV_PROJECT_ID=your_zerodev_project_id
PRIVATE_KEY=your_private_key
RPC_URL=your_sepolia_rpc_url
```

### 6. Run the Application

**Start the Next.js frontend:**
```bash
bun run dev
```

**Build & test smart contracts:**
```bash
cd contracts
forge build
forge test
```

---

## �📜 Deployed Contracts (Sepolia)

| Contract | Address |
|:---------|:--------|
| **AminoRiskFeeHook** | [`0x41B794D60e275D96ba393E301cB8b684604680C0`](https://sepolia.etherscan.io/address/0x41B794D60e275D96ba393E301cB8b684604680C0) |
| **AminoReputationRegistry** | [`0x3bb25e47ada8527c264c582f7763b6e5c2a8e2a6`](https://sepolia.etherscan.io/address/0x3bb25e47ada8527c264c582f7763b6e5c2a8e2a6) |
| **PoolRegistry** | [`0xf995fb0554d39fde02868470bfd2e2e2e9a043e1`](https://sepolia.etherscan.io/address/0xf995fb0554d39fde02868470bfd2e2e2e9a043e1) |
