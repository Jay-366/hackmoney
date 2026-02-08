
import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

    // Deployer
    const deployerInfo = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const deployerBal = await deployerInfo.getBalance();

    // Agent
    const agentKey = "dac64655d0b78804819c9a29c50038f49eba94619bd348eb3bd4676d2c3b712f";
    const agentWallet = new ethers.Wallet(agentKey, provider);
    const agentBal = await agentWallet.getBalance();

    console.log("Deployer:", deployerInfo.address);
    console.log("Balance:", ethers.utils.formatEther(deployerBal), "ETH");

    console.log("Agent:", agentWallet.address);
    console.log("Balance:", ethers.utils.formatEther(agentBal), "ETH");

    const gasPrice = await provider.getGasPrice();
    console.log("Gas Price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");

    const requiredFor5M = gasPrice.mul(5000000);
    console.log("Required for 5M Gas:", ethers.utils.formatEther(requiredFor5M), "ETH");
}

main();
