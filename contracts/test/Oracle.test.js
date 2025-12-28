const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ObscuraOracle Production Logic", function () {
    let oracle, token, stakeGuard, verifier;
    let owner, node1, node2, node3, requester;
    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const PAYMENT_FEE = ethers.parseEther("1");
    const MIN_STAKE = ethers.parseEther("100");

    beforeEach(async function () {
        [owner, node1, node2, node3, requester] = await ethers.getSigners();

        // 1. Deploy Token (new constructor takes owner address)
        const ObscuraToken = await ethers.getContractFactory("ObscuraToken");
        token = await ObscuraToken.deploy(owner.address);
        await token.waitForDeployment();

        // 2. Deploy StakeGuard
        const StakeGuard = await ethers.getContractFactory("StakeGuard");
        stakeGuard = await StakeGuard.deploy(await token.getAddress());
        await stakeGuard.waitForDeployment();

        // 3. Deploy Mock Verifier (or address 0 for now)
        verifier = ethers.ZeroAddress;

        // 4. Deploy Oracle
        const ObscuraOracle = await ethers.getContractFactory("ObscuraOracle");
        oracle = await ObscuraOracle.deploy(
            await token.getAddress(),
            await stakeGuard.getAddress(),
            verifier
        );
        await oracle.waitForDeployment();

        // 5. Setup Roles
        const SLASHER_ROLE = await stakeGuard.SLASHER_ROLE();
        await stakeGuard.grantRole(SLASHER_ROLE, await oracle.getAddress());

        // 6. Setup Nodes
        const nodes = [node1, node2, node3];
        const ADMIN_ROLE = await oracle.ADMIN_ROLE();
        for (const node of nodes) {
            await token.transfer(node.address, MIN_STAKE);
            await token.connect(node).approve(await stakeGuard.getAddress(), MIN_STAKE);
            await stakeGuard.connect(node).stake(MIN_STAKE);
            await oracle.grantRole(ADMIN_ROLE, owner.address); // Ensure owner has admin
            await oracle.setNodeWhitelist(node.address, true);
        }

        // 7. Setup Requester
        await token.transfer(requester.address, ethers.parseEther("10"));
        await token.connect(requester).approve(await oracle.getAddress(), ethers.parseEther("10"));
    });

    it("Should successfully request data and pay fee", async function () {
        const startBal = await token.balanceOf(requester.address);
        await expect(oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta"))
            .to.emit(oracle, "RequestData");

        const endBal = await token.balanceOf(requester.address);
        expect(startBal - endBal).to.equal(PAYMENT_FEE);
    });

    it("Should aggregate multiple node responses using median", async function () {
        await oracle.setMinResponses(3);
        const tx = await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
        const receipt = await tx.wait();
        const requestId = 0; // First request

        const proof = Array(8).fill(0);
        const pubInputs = Array(2).fill(0);

        // Node 1 submits 100
        await oracle.connect(node1).fulfillData(requestId, 100, proof, pubInputs);
        // Node 2 submits 150
        await oracle.connect(node2).fulfillData(requestId, 150, proof, pubInputs);

        let req = await oracle.requests(requestId);
        expect(req.resolved).to.be.false;

        // Node 3 submits 120 -> Median of [100, 120, 150] is 120
        await expect(oracle.connect(node3).fulfillData(requestId, 120, proof, pubInputs))
            .to.emit(oracle, "RequestFulfilled")
            .withArgs(requestId, 120);

        req = await oracle.requests(requestId);
        expect(req.resolved).to.be.true;
        expect(req.finalValue).to.equal(120);
    });

    it("Should fail if unauthorized node tries to fulfill", async function () {
        await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
        const proof = Array(8).fill(0);
        const pubInputs = Array(2).fill(0);

        await expect(oracle.connect(owner).fulfillData(0, 100, proof, pubInputs))
            .to.be.revertedWith("Not whitelisted");
    });

    it("Should allow nodes to claim rewards after aggregation", async function () {
        await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
        const proof = Array(8).fill(0);
        const pubInputs = Array(2).fill(0);

        await oracle.connect(node1).fulfillData(0, 100, proof, pubInputs);

        const reward = await oracle.nodeRewards(node1.address);
        expect(reward).to.be.greaterThan(0n);

        const startBal = await token.balanceOf(node1.address);
        await oracle.connect(node1).claimRewards();
        const endBal = await token.balanceOf(node1.address);

        expect(endBal - startBal).to.equal(reward);
    });

    it("Should allow requester to cancel and refund after timeout", async function () {
        await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");

        // Fast forward 2 hours
        await ethers.provider.send("evm_increaseTime", [3600 * 2]);
        await ethers.provider.send("evm_mine");

        const startBal = await token.balanceOf(requester.address);
        await oracle.connect(requester).cancelRequest(0);
        const endBal = await token.balanceOf(requester.address);

        expect(endBal - startBal).to.equal(PAYMENT_FEE);
    });

    it("Should slash nodes that provide outlier values", async function () {
        await oracle.setMinResponses(3);
        await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");

        const proof = Array(8).fill(0);
        const pubInputs = Array(2).fill(0);

        // Median will be 120 (from 100, 120, 500)
        // 500 is > 120 * 1.5 (180), so it should be slashed
        await oracle.connect(node1).fulfillData(0, 100, proof, pubInputs);
        await oracle.connect(node2).fulfillData(0, 120, proof, pubInputs);

        const startStaked = (await stakeGuard.stakers(node3.address)).balance;

        await oracle.connect(node3).fulfillData(0, 500, proof, pubInputs);

        const endStaked = (await stakeGuard.stakers(node3.address)).balance;
        expect(startStaked - endStaked).to.equal(ethers.parseEther("10")); // SLASH_AMOUNT
    });
});
