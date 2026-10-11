const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting Fairwork deployment...");
  
  const network = hre.network.name;
  console.log("Target network:", network);
  
  if (network === "sepolia") {
    if (!process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) {
      throw new Error("BLOCKER: NEXT_PUBLIC_SEPOLIA_RPC_URL is missing.");
    }
    if (!process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY) {
      throw new Error("BLOCKER: SEPOLIA_DEPLOYER_PRIVATE_KEY is missing. You need a funded Sepolia wallet.");
    }
  } else if (network === "hardhat" || network === "localhost") {
    console.log("Using local deterministic testing network (Chain ID 31337).");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await deployer.getBalance();
  console.log("Deployer balance:", hre.ethers.utils.formatEther(balance), "ETH");

  if (balance.eq(0)) {
    throw new Error("BLOCKER: Deployer has 0 balance. Need faucet funds.");
  }

  // Define Demo Allocations (Total must be 6000)
  // For the demo, we allocate 4000 to the deployer (acting as buyer) and 2000 to a mock freelancer, 
  // or just 6000 to deployer to simplify distribution later.
  const allocations = [6000n];
  const recipients = [deployer.address];

  const totalAllocated = allocations.reduce((a, b) => a + b, 0n);
  if (totalAllocated !== 6000n) {
    throw new Error(`BLOCKER: Total allocation is ${totalAllocated}, expected exactly 6000.`);
  }

  // 1. Deploy Token
  console.log("Deploying FairworkToken...");
  const Token = await hre.ethers.getContractFactory("FairworkToken");
  const token = await Token.deploy(recipients, allocations);
  await token.deployed();
  console.log("FairworkToken deployed to:", token.address);

  // 2. Deploy Escrow
  console.log("Deploying FairworkEscrow...");
  const Escrow = await hre.ethers.getContractFactory("FairworkEscrow");
  const escrow = await Escrow.deploy(token.address);
  await escrow.deployed();
  console.log("FairworkEscrow deployed to:", escrow.address);

  // Verification checks
  const supply = await token.totalSupply();
  console.log("Verified Token Supply:", supply.toString());
  if (supply.toString() !== "6000") throw new Error("Supply mismatch!");

  const escrowTokenAddress = await escrow.token();
  if (escrowTokenAddress !== token.address) throw new Error("Escrow token reference mismatch!");

  // Save Manifest
  const manifest = {
    network,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    tokenAddress: token.address,
    escrowAddress: escrow.address,
    timestamp: new Date().toISOString()
  };

  const manifestPath = path.join(__dirname, "..", "deployment-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Deployment manifest saved to ${manifestPath}`);
  
  console.log("\nDeployment Successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
