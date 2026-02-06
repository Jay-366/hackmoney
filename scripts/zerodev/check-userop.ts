import axios from 'axios';
import 'dotenv/config';

const PROJECT_ID = process.env.ZERODEV_PROJECT_ID;
const BUNDLER_URL = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`;

async function checkUserOp(userOpHash: string) {
    console.log(`🔎 Checking UserOp: ${userOpHash}`);
    try {
        const response = await axios.post(BUNDLER_URL, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getUserOperationReceipt',
            params: [userOpHash]
        });

        if (response.data.error) {
            console.error("Bundler Error:", response.data.error);
            return;
        }

        const receipt = response.data.result;
        if (!receipt) {
            console.log("⏳ UserOp is still pending or not found.");
        } else {
            console.log("✅ UserOp processed!");
            console.log("Success:", receipt.success);
            console.log("Transaction Hash:", receipt.receipt.transactionHash);
            if (!receipt.success) {
                console.error("❌ Revert Reason:", receipt.reason);
            }
        }
    } catch (error: any) {
        console.error("RPC Request Failed:", error.message);
    }
}

const args = process.argv.slice(2);
if (args.length > 0) {
    checkUserOp(args[0]);
} else {
    console.log("Usage: bun scripts/check-userop.ts <USER_OP_HASH>");
}
