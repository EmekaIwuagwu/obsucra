// Sepolia Testnet Deployment Script for Obscura Oracle
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Obscura Oracle to Sepolia Testnet...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH\n");

    if (balance < ethers.parseEther("0.1")) {
        console.log("⚠️  Warning: Low balance. You may need more Sepolia ETH.");
        console.log("   Get free Sepolia ETH from: https://sepoliafaucet.com/\n");
    }

    // Deploy MockVerifier (for testing ZK proofs)
    console.log("📦 Deploying MockVerifier...");
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    const verifier = await MockVerifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ MockVerifier deployed to:", verifierAddress);

    // Deploy ObscuraOracle
    console.log("\n📦 Deploying ObscuraOracle...");
    const ObscuraOracle = await ethers.getContractFactory("ObscuraOracle");
    const oracle = await ObscuraOracle.deploy(verifierAddress);
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ ObscuraOracle deployed to:", oracleAddress);

    // Deploy StakeGuard
    console.log("\n📦 Deploying StakeGuard...");
    const StakeGuard = await ethers.getContractFactory("StakeGuard");
    const stakeGuard = await StakeGuard.deploy();
    await stakeGuard.waitForDeployment();
    const stakeGuardAddress = await stakeGuard.getAddress();
    console.log("✅ StakeGuard deployed to:", stakeGuardAddress);

    // Configuration
    console.log("\n⚙️  Configuring contracts...");

    // Register deployer as an authorized node
    const registerTx = await oracle.registerNode(deployer.address);
    await registerTx.wait();
    console.log("✅ Deployer registered as authorized node");

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("Network:        Sepolia Testnet");
    console.log("Block Explorer: https://sepolia.etherscan.io");
    console.log("");
    console.log("Contracts:");
    console.log(`  MockVerifier:   ${verifierAddress}`);
    console.log(`  ObscuraOracle:  ${oracleAddress}`);
    console.log(`  StakeGuard:     ${stakeGuardAddress}`);
    console.log("");
    console.log("Next Steps:");
    console.log("  1. Verify contracts on Etherscan:");
    console.log(`     npx hardhat verify --network sepolia ${verifierAddress}`);
    console.log(`     npx hardhat verify --network sepolia ${oracleAddress} ${verifierAddress}`);
    console.log(`     npx hardhat verify --network sepolia ${stakeGuardAddress}`);
    console.log("");
    console.log("  2. Update your .env file with:");
    console.log(`     ORACLE_ADDRESS=${oracleAddress}`);
    console.log(`     STAKE_GUARD_ADDRESS=${stakeGuardAddress}`);
    console.log("");
    console.log("  3. Start the backend node:");
    console.log("     cd backend && go run ./cmd/obscura start");
    console.log("=".repeat(60));

    // Save deployment info to file
    const deploymentInfo = {
        network: "sepolia",
        chainId: 11155111,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            MockVerifier: verifierAddress,
            ObscuraOracle: oracleAddress,
            StakeGuard: stakeGuardAddress,
        },
        verification: {
            MockVerifier: `npx hardhat verify --network sepolia ${verifierAddress}`,
            ObscuraOracle: `npx hardhat verify --network sepolia ${oracleAddress} ${verifierAddress}`,
            StakeGuard: `npx hardhat verify --network sepolia ${stakeGuardAddress}`,
        }
    };

    const fs = require("fs");
    fs.writeFileSync(
        "deployments/sepolia.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n💾 Deployment info saved to deployments/sepolia.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
