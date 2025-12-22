const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ObscuraOracle", function () {
    let oracle;
    let owner, addr1;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("ObscuraToken");
        const token = await Token.deploy(ethers.parseEther("1000000"));

        const StakeGuard = await ethers.getContractFactory("StakeGuard");
        const stakeGuard = await StakeGuard.deploy(await token.getAddress());

        const Oracle = await ethers.getContractFactory("ObscuraOracle");
        oracle = await Oracle.deploy(await stakeGuard.getAddress());

        // Whitelist owner as a node for testing
        await oracle.setNodeWhitelist(owner.address, true);

        // Stake to become active
        await token.approve(await stakeGuard.getAddress(), ethers.parseEther("1000"));
        await stakeGuard.stake(ethers.parseEther("1000"));
    });

    it("Should emit RequestData event", async function () {
        const url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
        await expect(oracle.requestData(url))
            .to.emit(oracle, "RequestData")
            .withArgs(0, url, owner.address);
    });

    it("Should fulfill request", async function () {
        const url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT";
        await oracle.requestData(url);

        const value = 6500000;
        const proof = ethers.toUtf8Bytes("simulated-proof");

        await expect(oracle.fulfillData(0, value, proof))
            .to.emit(oracle, "DataFulfilled")
            .withArgs(0, value, proof);

        const req = await oracle.requests(0);
        expect(req.resolved).to.equal(true);
        expect(req.value).to.equal(value);
    });
});
