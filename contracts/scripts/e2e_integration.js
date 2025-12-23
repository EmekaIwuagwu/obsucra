const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting Obscura E2E Integration Setup...");

    const [owner, node, requester] = await ethers.getSigners();
    console.log(`- Owner: ${owner.address}`);
    console.log(`- Node: ${node.address}`);
    console.log(`- Requester: ${requester.address}`);

    // 1. Deploy ObscuraToken
    console.log("\n📦 Deploying ObscuraToken...");
    const Token = await ethers.getContractFactory("ObscuraToken");
    const token = await Token.deploy(ethers.parseEther("1000000"));
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();
    console.log(`✅ Token deployed at: ${tokenAddr}`);

    // 2. Deploy StakeGuard
    console.log("\n🛡️ Deploying StakeGuard...");
    const StakeGuard = await ethers.getContractFactory("StakeGuard");
    const stakeGuard = await StakeGuard.deploy(tokenAddr);
    await stakeGuard.waitForDeployment();
    const stakeGuardAddr = await stakeGuard.getAddress();
    console.log(`✅ StakeGuard deployed at: ${stakeGuardAddr}`);

    // 3. Deploy Verifier
    console.log("\n🔍 Deploying Verifier (ZKP)...");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddr = await verifier.getAddress();
    console.log(`✅ Verifier deployed at: ${verifierAddr}`);

    // 4. Deploy ObscuraOracle
    console.log("\n🔮 Deploying ObscuraOracle...");
    const Oracle = await ethers.getContractFactory("ObscuraOracle");
    const oracle = await Oracle.deploy(tokenAddr, stakeGuardAddr, verifierAddr);
    await oracle.waitForDeployment();
    const oracleAddr = await oracle.getAddress();
    console.log(`✅ Oracle deployed at: ${oracleAddr}`);

    // 5. Setup Permissions
    console.log("\n⚙️ Configuring Permissions...");
    const SLASHER_ROLE = await stakeGuard.SLASHER_ROLE();
    await stakeGuard.grantRole(SLASHER_ROLE, oracleAddr);
    await oracle.setNodeWhitelist(node.address, true);
    console.log("✅ Roles configured.");

    // 6. Stake Node
    console.log("\n🥩 Staking Node...");
    const stakeAmount = ethers.parseEther("5000");
    await token.transfer(node.address, stakeAmount);
    await token.connect(node).approve(stakeGuardAddr, stakeAmount);
    await stakeGuard.connect(node).stake(stakeAmount);
    console.log(`✅ Node staked ${ethers.formatEther(stakeAmount)} OBS`);

    // 7. Seed Requester
    await token.transfer(requester.address, ethers.parseEther("100"));
    await token.connect(requester).approve(oracleAddr, ethers.parseEther("100"));
    console.log("✅ Requester seeded with fees.");

    // 8. Generate Config for Node Backend
    const config = {
        ethereum_url: "http://localhost:8545",
        private_key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat #0 for testing
        oracle_contract_address: oracleAddr,
        stake_guard_address: stakeGuardAddr,
        db_path: "./node.db.json",
        port: "8080",
        log_level: "debug"
    };

    const configPath = path.join(__dirname, "../../backend/config.yaml");
    const yamlContent = `ethereum_url: "http://localhost:8545"
private_key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
oracle_contract_address: "${oracleAddr}"
stake_guard_address: "${stakeGuardAddr}"
db_path: "./node.db.json"
port: "8080"
log_level: "debug"
`;

    fs.writeFileSync(configPath, yamlContent);
    console.log(`\n📝 Generated backend config at: ${configPath}`);

    console.log("\n✨ E2E Setup Complete!");
    console.log("--------------------------------------------------");
    console.log("NEXT STEPS:");
    console.log("1. Run a local Hardhat node: 'npx hardhat node'");
    console.log("2. Deploy this script to it: 'npx hardhat run scripts/e2e_integration.js --network localhost'");
    console.log("3. Start the Go backend: 'cd backend && go run main.go'");
    console.log("4. In a new terminal, trigger a request: 'npx hardhat run scripts/trigger_request.js --network localhost'");
    console.log("--------------------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
