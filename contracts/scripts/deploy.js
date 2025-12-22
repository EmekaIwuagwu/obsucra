const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("=".repeat(60));
    console.log("Deploying Obscura Oracle Contracts");
    console.log("=".repeat(60));
    console.log("Deployer address:", deployer.address);
    console.log("Network:", hre.network.name);
    console.log("");

    const deployedAddresses = {};

    // 1. Deploy ObscuraToken
    console.log("📦 Deploying ObscuraToken...");
    const ObscuraToken = await hre.ethers.getContractFactory("ObscuraToken");
    const initialSupply = hre.ethers.parseEther("1000000"); // 1M tokens
    const token = await ObscuraToken.deploy(initialSupply);
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    deployedAddresses.obscuraToken = tokenAddr;
    console.log("✅ ObscuraToken deployed to:", tokenAddr);
    console.log("");

    // 2. Deploy StakeGuard
    console.log("📦 Deploying StakeGuard...");
    const StakeGuard = await hre.ethers.getContractFactory("StakeGuard");
    const stakeGuard = await StakeGuard.deploy(tokenAddr);
    await stakeGuard.waitForDeployment();
    const stakeGuardAddr = await stakeGuard.getAddress();
    deployedAddresses.stakeGuard = stakeGuardAddr;
    console.log("✅ StakeGuard deployed to:", stakeGuardAddr);
    console.log("");

    // 3. Deploy Verifier (ZK Proof Verifier)
    console.log("📦 Deploying Verifier...");
    const Verifier = await hre.ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddr = await verifier.getAddress();
    deployedAddresses.verifier = verifierAddr;
    console.log("✅ Verifier deployed to:", verifierAddr);
    console.log("");

    // 4. Deploy ObscuraOracle (with correct constructor: token, stakeGuard, verifier)
    console.log("📦 Deploying ObscuraOracle...");
    const ObscuraOracle = await hre.ethers.getContractFactory("ObscuraOracle");
    const oracle = await ObscuraOracle.deploy(tokenAddr, stakeGuardAddr, verifierAddr);
    await oracle.waitForDeployment();
    const oracleAddr = await oracle.getAddress();
    deployedAddresses.obscuraOracle = oracleAddr;
    console.log("✅ ObscuraOracle deployed to:", oracleAddr);
    console.log("");

    // 5. Setup Roles
    console.log("🔐 Setting up roles...");
    const SLASHER_ROLE = await stakeGuard.SLASHER_ROLE();
    const tx1 = await stakeGuard.grantRole(SLASHER_ROLE, oracleAddr);
    await tx1.wait();
    console.log("✅ Granted SLASHER_ROLE to ObscuraOracle");
    console.log("");

    // 6. Save deployment addresses to JSON
    const outputPath = path.join(__dirname, "..", "deployed.json");
    const output = {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: deployedAddresses
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log("💾 Deployment addresses saved to:", outputPath);
    console.log("");

    // 7. Summary
    console.log("=".repeat(60));
    console.log("Deployment Summary");
    console.log("=".repeat(60));
    console.log("ObscuraToken:  ", tokenAddr);
    console.log("StakeGuard:    ", stakeGuardAddr);
    console.log("Verifier:      ", verifierAddr);
    console.log("ObscuraOracle: ", oracleAddr);
    console.log("=".repeat(60));
    console.log("");
    console.log("✅ All contracts deployed successfully!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Update backend config with these addresses");
    console.log("2. Whitelist oracle nodes in ObscuraOracle");
    console.log("3. Fund nodes with OBSCURA tokens for staking");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
