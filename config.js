'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
    arbitrum,
    base,
    mainnet,
    optimism,
    polygon,
    sepolia,
    baseSepolia,
} from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'RainbowKit App',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
    chains: [
        mainnet,
        polygon,
        optimism,
        arbitrum,
        base,
        sepolia,
        baseSepolia,
    ],
    ssr: true,
});
