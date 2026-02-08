import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';
import { encodeHookData } from '@/lib/hookData';

// Force Node.js runtime to use native fetch (bypasses Next.js polyfill that causes Referrer issues)
export const runtime = 'nodejs';


// Contract addresses (Sepolia)
const UNIVERSAL_ROUTER = '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b';
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const ETH_TOKEN = '0x209A45E3242a2985bA5701e07615B441FF2593c9'; // MockETH
const USDC_TOKEN = '0xAf6C3A632806ED83155F9F582D1C63aC31d1d435'; // MockUSDC
const HOOK = '0x41B794D60e275D96ba393E301cB8b684604680C0';
const FEE = 5500;
const TICK_SPACING = 66;

const UNIVERSAL_ROUTER_ABI = [
    {
        inputs: [
            { internalType: 'bytes', name: 'commands', type: 'bytes' },
            { internalType: 'bytes[]', name: 'inputs', type: 'bytes[]' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'execute',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
];

const HOOK_ABI = [
    'event SwapRecorded(bytes32 indexed swapId, bytes32 indexed poolId, address indexed sender, uint256 agentId, uint160 sqrtPriceBeforeX96, uint160 sqrtPriceAfterX96, uint24 feeBps, uint256 Rnow)',
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { amountIn, agentId = 945 } = body;

        if (!amountIn || isNaN(parseFloat(amountIn))) {
            return NextResponse.json({ error: 'Invalid amountIn' }, { status: 400 });
        }

        // Setup provider and wallet
        // Hardcode the known working RPC URL from the script
        const rpcUrl = 'https://eth-sepolia.g.alchemy.com/v2/-KglqcW5EJVPutTa6Z7AK';

        console.log('Using RPC URL:', rpcUrl?.substring(0, 50) + '...');

        let privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return NextResponse.json({ error: 'PRIVATE_KEY not configured' }, { status: 500 });
        }
        if (!privateKey.startsWith('0x')) privateKey = `0x${privateKey}`;

        // Use StaticJsonRpcProvider with simple URL string (avoids ConnectionInfo issues)
        // StaticJsonRpcProvider doesn't make net_version calls, which is safer for serverless
        const provider = new ethers.providers.StaticJsonRpcProvider(rpcUrl, {
            name: 'sepolia',
            chainId: 11155111
        });

        // Test connection
        try {
            const network = await provider.getNetwork();
            console.log('Connected to network:', network.name, 'chainId:', network.chainId);
        } catch (networkError) {
            console.error('Network connection failed:', networkError);
            return NextResponse.json({
                error: `Failed to connect to network. RPC URL may be invalid or rate-limited.`
            }, { status: 500 });
        }

        const wallet = new ethers.Wallet(privateKey, provider);

        // Parse amount
        const amountInWei = ethers.utils.parseUnits(amountIn.toString(), 18);

        // Check balance
        const mockEth = new ethers.Contract(ETH_TOKEN, ERC20_ABI, wallet);
        const balance = await mockEth.balanceOf(wallet.address);
        if (balance.lt(amountInWei)) {
            return NextResponse.json({
                error: `Insufficient MockETH balance. Have: ${ethers.utils.formatUnits(balance, 18)}, Need: ${amountIn}`,
            }, { status: 400 });
        }

        // Hook data
        const hookData = encodeHookData({ agentId: BigInt(agentId), proof: '0x' });

        // Determine token order
        const isEthToken0 = ETH_TOKEN.toLowerCase() < USDC_TOKEN.toLowerCase();

        const swapConfig = {
            poolKey: {
                currency0: isEthToken0 ? ETH_TOKEN : USDC_TOKEN,
                currency1: isEthToken0 ? USDC_TOKEN : ETH_TOKEN,
                fee: FEE,
                tickSpacing: TICK_SPACING,
                hooks: HOOK,
            },
            zeroForOne: isEthToken0,
            amountIn: amountInWei.toString(),
            amountOutMinimum: '0',
            hookData,
        };

        // Build swap transaction
        const v4Planner = new V4Planner();
        const routePlanner = new RoutePlanner();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
        v4Planner.addAction(Actions.SETTLE_ALL, [swapConfig.poolKey.currency0, swapConfig.amountIn]);
        v4Planner.addAction(Actions.TAKE_ALL, [swapConfig.poolKey.currency1, swapConfig.amountOutMinimum]);

        const encodedActions = v4Planner.finalize();
        routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

        // Approve Permit2
        const approveTx = await mockEth.approve(PERMIT2, ethers.constants.MaxUint256);
        await approveTx.wait();

        // Approve Router on Permit2
        const permit2Contract = new ethers.Contract(PERMIT2, [
            'function approve(address token, address spender, uint160 amount, uint48 expiration) external',
        ], wallet);
        const maxUint160 = ethers.BigNumber.from('1461501637330902918203684832716283019655932542975');
        const p2Tx = await permit2Contract.approve(ETH_TOKEN, UNIVERSAL_ROUTER, maxUint160, 2000000000000);
        await p2Tx.wait();

        // Execute swap
        const ur = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, wallet);
        const tx = await ur.execute(routePlanner.commands, routePlanner.inputs, deadline, {
            value: 0,
            gasLimit: 5000000,
        });

        const receipt = await tx.wait();

        // Parse SwapRecorded event
        const hookInterface = new ethers.utils.Interface(HOOK_ABI);
        let swapEvent: {
            swapId: string;
            sender: string;
            agentId: string;
            feeBps: number;
            Rnow: string;
        } | null = null;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === HOOK.toLowerCase()) {
                try {
                    const parsed = hookInterface.parseLog(log);
                    if (parsed.name === 'SwapRecorded') {
                        swapEvent = {
                            swapId: parsed.args.swapId,
                            sender: parsed.args.sender,
                            agentId: parsed.args.agentId.toString(),
                            feeBps: parsed.args.feeBps,
                            Rnow: ethers.utils.formatUnits(parsed.args.Rnow, 18),
                        };
                        break;
                    }
                } catch {
                    // Not this event
                }
            }
        }

        // Get USDC balance change
        const usdcContract = new ethers.Contract(USDC_TOKEN, ERC20_ABI, provider);
        const usdcBalanceAfter = await usdcContract.balanceOf(wallet.address);

        return NextResponse.json({
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            swapEvent,
            usdcBalance: ethers.utils.formatUnits(usdcBalanceAfter, 6),
        });

    } catch (error) {
        console.error('Swap error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Swap failed',
        }, { status: 500 });
    }
}
