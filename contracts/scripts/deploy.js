const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy Token
    const ObscuraToken = await hre.ethers.getContractFactory("ObscuraToken");
    const token = await ObscuraToken.deploy();
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log("ObscuraToken deployed to:", tokenAddr);

    // Deploy Mock Verifier (if needed, or use a real address)
    // For now we assume a dummy address or deploy a MockVerifier
    // const Verifier = await hre.ethers.getContractFactory("Verifier"); ...
    const mockVerifierAddr = "0x0000000000000000000000000000000000000000";

    // Deploy Oracle
    const ObscuraOracle = await hre.ethers.getContractFactory("ObscuraOracle");
    const oracle = await ObscuraOracle.deploy(mockVerifierAddr, hre.ethers.parseEther("0.1"));
    await oracle.waitForDeployment();
    console.log("ObscuraOracle deployed to:", await oracle.getAddress());

    // Deploy StakeGuard
    const StakeGuard = await hre.ethers.getContractFactory("StakeGuard");
    const stakeGuard = await StakeGuard.deploy(tokenAddr);
    await stakeGuard.waitForDeployment();
    console.log("StakeGuard deployed to:", await stakeGuard.getAddress());

    // Deploy VRF
    const VRF = await hre.ethers.getContractFactory("VRF");
    const vrf = await VRF.deploy();
    await vrf.waitForDeployment();
    console.log("VRF deployed to:", await vrf.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
