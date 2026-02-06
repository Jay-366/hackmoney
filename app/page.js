"use client";

import Image from "next/image";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center py-16 px-8 bg-white dark:bg-black">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-6 w-full mb-16">
          <div className="flex w-full justify-between items-center">
            <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
              HackMoney V4
            </h1>
            <ConnectButton />
          </div>
          <p className="w-full text-center text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
            A Next.js 16 + Wagmi + RainbowKit template for Uniswap V4.
            <br />
            Initialize pools, register them, and provide liquidity securely.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

          {/* Card 1: View Pools */}
          <Link
            href="/pools"
            className="group flex flex-col p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer"
          >
            <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M19.125 19.5h1.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Pools Registry
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Explore existing Uniswap V4 pools registered on this chain. View details and add liquidity.
            </p>
          </Link>

          {/* Card 2: Create Position */}
          <Link
            href="/positions/create"
            className="group flex flex-col p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 transition-all cursor-pointer"
          >
            <div className="h-12 w-12 rounded-full bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center mb-4 text-pink-600 dark:text-pink-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black dark:text-white mb-2 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
              New Position / Initialize &rarr;
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Initialize a new V4 pool or add liquidity to an existing one. Customize fee tiers and ranges.
            </p>
          </Link>

        </div>

        {/* Footer / Links */}
        <div className="mt-16 flex flex-col gap-4 text-sm font-medium sm:flex-row w-full justify-center opacity-50 hover:opacity-100 transition-opacity">
          <a
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            href="https://github.com/Uniswap/v4-core"
            target="_blank"
            rel="noopener noreferrer"
          >
            Uniswap V4 Core
          </a>
          <a
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            href="https://github.com/Uniswap/v4-periphery"
            target="_blank"
            rel="noopener noreferrer"
          >
            Uniswap V4 Periphery
          </a>
        </div>
      </main>
    </div>
  );
}
