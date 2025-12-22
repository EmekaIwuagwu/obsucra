const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying Obscura Network Contracts...");

    // 1. Deploy Token
    const ObscuraToken = await hre.ethers.getContractFactory("ObscuraToken");
    const token = await ObscuraToken.deploy(hre.ethers.parseEther("100000000"));
    await token.waitForDeployment();
    console.log("✅ ObscuraToken deployed to:", await token.getAddress());

    // 2. Deploy StakeGuard
    const StakeGuard = await hre.ethers.getContractFactory("StakeGuard");
    const stakeGuard = await StakeGuard.deploy(await token.getAddress());
    await stakeGuard.waitForDeployment();
    console.log("✅ StakeGuard deployed to:", await stakeGuard.getAddress());

    // 3. Deploy Verifier (Generated from Go)
    const Verifier = await hre.ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    console.log("✅ Verifier deployed to:", await verifier.getAddress());

    // 4. Deploy Oracle
    const ObscuraOracle = await hre.ethers.getContractFactory("ObscuraOracle");
    const oracle = await ObscuraOracle.deploy(await stakeGuard.getAddress(), await verifier.getAddress());
    await oracle.waitForDeployment();
    console.log("✅ ObscuraOracle deployed to:", await oracle.getAddress());

    console.log("\n🌐 Network Setup Complete.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
