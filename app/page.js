"use client";

import Image from "next/image";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import * as React from 'react';
import { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useSwitchChain } from 'wagmi';
import { getPoolManagerAddress, ANVIL_CHAIN_ID, SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID } from '@/lib/uniswapV4Addresses';
import { sortTokens } from '@/lib/sortTokens';

const POOL_MANAGER_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "currency0", "type": "address" },
          { "internalType": "address", "name": "currency1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
          { "internalType": "address", "name": "hooks", "type": "address" }
        ],
        "internalType": "struct PoolKey",
        "name": "key",
        "type": "tuple"
      },
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" }
    ],
    "name": "initialize",
    "outputs": [{ "internalType": "int24", "name": "tick", "type": "int24" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [fee, setFee] = useState('3000');
  const [tickSpacing, setTickSpacing] = useState('60');
  const [startingPriceX96, setStartingPriceX96] = useState('79228162514264337593543950336'); // 2^96

  // Set defaults based on chain
  React.useEffect(() => {
    if (chainId === ANVIL_CHAIN_ID) {
      setTokenA('0x0165878A594ca255338adfa4d48449f69242Eb8F');
      setTokenB('0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
    } else if (chainId === SEPOLIA_CHAIN_ID) {
      setTokenA('0x0000000000000000000000000000000000000000');
      setTokenB('0xe6ba97E2d85B1d0474AAbDd0969C0C4670377d0E');
    } else {
      setTokenA('');
      setTokenB('');
    }
  }, [chainId]);

  const [status, setStatus] = useState('');
  const [txHash, setTxHash] = useState('');

  const handleCreatePool = async () => {
    setStatus('');
    setTxHash('');

    if (!isConnected) return;

    try {
      const pmAddress = getPoolManagerAddress(chainId);
      if (!pmAddress) {
        setStatus(`Error: PoolManager not found for chain ${chainId} or .env missing`);
        return;
      }

      if (tokenA === tokenB) {
        setStatus('Error: Token A and Token B cannot be the same');
        return;
      }

      // Input validation
      let priceBI;
      try {
        priceBI = BigInt(startingPriceX96);
        if (priceBI <= 0n) throw new Error("Price must be > 0");
      } catch (e) {
        setStatus('Error: Invalid Starting Price X96');
        return;
      }

      const [currency0, currency1] = sortTokens(tokenA, tokenB);

      const poolKey = {
        currency0,
        currency1,
        fee: parseInt(fee),
        tickSpacing: parseInt(tickSpacing),
        hooks: '0x0000000000000000000000000000000000000000'
      };

      setStatus('Creating pool...');

      const hash = await writeContractAsync({
        address: pmAddress,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [
          poolKey,
          priceBI
        ]
      });

      setTxHash(hash);
      setStatus('Success! Transaction sent.');

    } catch (err) {
      console.error(err);
      const message = err.message || 'Transaction failed';
      if (message.includes('gas limit too high') || message.includes('gas required exceeds allowance')) {
        setStatus('Error: Gas estimation failed. The pool might already exist, or the contract is missing on this chain.');
      } else {
        setStatus(`Error: ${message}`);
      }
    }
  };

  const getExplorerLink = (hash) => {
    if (chainId === SEPOLIA_CHAIN_ID) return `https://sepolia.etherscan.io/tx/${hash}`;
    if (chainId === BASE_SEPOLIA_CHAIN_ID) return `https://sepolia.basescan.org/tx/${hash}`;
    return null;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-16 px-8 bg-white dark:bg-black sm:items-start">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-6 w-full mb-12">
          <div className="flex w-full justify-between items-center">
            <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
              HackMoney
            </h1>
            <ConnectButton />
          </div>
          <p className="w-full text-lg text-zinc-600 dark:text-zinc-400">
            Uniswap V4 Pool Creator
          </p>
        </div>

        {/* Create Pool Section */}
        <div className="w-full p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-black dark:text-white">Create Uniswap v4 Pool</h2>

          <div className="grid gap-4">
            {/* Tokens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Token A Address</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white text-sm font-mono"
                  value={tokenA}
                  onChange={(e) => setTokenA(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Token B Address</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white text-sm font-mono"
                  value={tokenB}
                  onChange={(e) => setTokenB(e.target.value)}
                />
              </div>
            </div>

            {/* Params */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Fee (pips)</label>
                <input
                  type="number"
                  className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white text-sm"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Tick Spacing</label>
                <input
                  type="number"
                  className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white text-sm"
                  value={tickSpacing}
                  onChange={(e) => setTickSpacing(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Start Price X96</label>
                <input
                  type="text"
                  className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white text-sm font-mono"
                  value={startingPriceX96}
                  onChange={(e) => setStartingPriceX96(e.target.value)}
                />
              </div>
            </div>

            {/* Info & Errors */}
            <div className="mt-2 text-sm">
              <p className="text-zinc-500">Current Chain: {chainId} ({chainId === ANVIL_CHAIN_ID ? 'Anvil' : chainId === SEPOLIA_CHAIN_ID ? 'Sepolia' : chainId === BASE_SEPOLIA_CHAIN_ID ? 'Base Sepolia' : 'Unknown'})</p>
              {![ANVIL_CHAIN_ID, SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID].includes(chainId) && (
                <p className="text-red-500 font-medium">Unsupported network. Please switch to Anvil or Sepolia.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-4">
              {isConnected && ![ANVIL_CHAIN_ID, SEPOLIA_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID].includes(chainId) ? (
                <button
                  onClick={() => switchChain({ chainId: ANVIL_CHAIN_ID })}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                >
                  Switch to Anvil
                </button>
              ) : (
                <button
                  onClick={handleCreatePool}
                  disabled={!isConnected || !tokenA || !tokenB || !!status && status.startsWith('Creating')}
                  className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {isConnected ? 'Create Pool' : 'Connect Wallet to Create'}
                </button>
              )}
            </div>

            {/* Status Output */}
            {status && (
              <div className={`p-4 rounded border ${status.includes('Error') ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'}`}>
                <p className="font-medium break-all">{status}</p>
                {txHash && (
                  <div className="mt-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Tx Hash: <span className="font-mono text-zinc-900 dark:text-zinc-200">{txHash}</span></p>
                    {getExplorerLink(txHash) && (
                      <a
                        href={getExplorerLink(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline text-indigo-600 dark:text-indigo-400 mt-1 inline-block"
                      >
                        View on Explorer
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full justify-center">
          <a href="/pools" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
            &rarr; Go to Pools Registry & Liquidity
          </a>
        </div>
        {/* Footer / Links */}
        <div className="mt-6 flex flex-col gap-4 text-base font-medium sm:flex-row w-full justify-center opacity-50 hover:opacity-100 transition-opacity">
          <a
            className="flex h-12 items-center justify-center gap-2 rounded-full px-5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            href="https://Uniswap.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Uniswap V4 Docs
          </a>
        </div>
      </main>
    </div>
  );
}
