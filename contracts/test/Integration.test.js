const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ObscuraOracle Integration Tests", function () {
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

        // 3. Deploy Mock Verifier
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
        for (const node of nodes) {
            await token.transfer(node.address, MIN_STAKE);
            await token.connect(node).approve(await stakeGuard.getAddress(), MIN_STAKE);
            await stakeGuard.connect(node).stake(MIN_STAKE);
            await oracle.setNodeWhitelist(node.address, true);
        }

        // 7. Setup Requester
        await token.transfer(requester.address, ethers.parseEther("10"));
        await token.connect(requester).approve(await oracle.getAddress(), ethers.parseEther("10"));
    });

    describe("Chainlink Compatibility", function () {
        it("Should return correct decimals", async function () {
            const decimals = await oracle.decimals();
            expect(decimals).to.equal(8);
        });

        it("Should return correct description", async function () {
            const description = await oracle.description();
            expect(description).to.equal("Obscura Privacy Oracle Feed");
        });

        it("Should return correct version", async function () {
            const version = await oracle.version();
            expect(version).to.equal(1n);
        });

        it("Should revert latestRoundData when no rounds exist", async function () {
            await expect(oracle.latestRoundData()).to.be.revertedWith("No rounds exist");
        });

        it("Should return correct latestRoundData after fulfillment", async function () {
            // Submit a request and fulfill it
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");

            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);
            await oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs); // $385.00 with 8 decimals

            // Get latest round data
            const [roundId, answer, startedAt, updatedAt, answeredInRound] = await oracle.latestRoundData();

            expect(roundId).to.equal(1n);
            expect(answer).to.equal(38500000000n);
            expect(startedAt).to.be.greaterThan(0n);
            expect(updatedAt).to.be.greaterThan(0n);
            expect(answeredInRound).to.equal(1n);
        });

        it("Should return correct getRoundData for historical rounds", async function () {
            // Create multiple rounds
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);
            await oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs);

            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
            await oracle.connect(node1).fulfillData(1, 39000000000n, proof, pubInputs);

            // Check round 1
            const [roundId1, answer1, , ,] = await oracle.getRoundData(1);
            expect(roundId1).to.equal(1n);
            expect(answer1).to.equal(38500000000n);

            // Check round 2
            const [roundId2, answer2, , ,] = await oracle.getRoundData(2);
            expect(roundId2).to.equal(2n);
            expect(answer2).to.equal(39000000000n);
        });

        it("Should return latestAnswer correctly", async function () {
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);
            await oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs);

            const answer = await oracle.latestAnswer();
            expect(answer).to.equal(38500000000n);
        });

        it("Should return latestTimestamp correctly", async function () {
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);
            await oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs);

            const timestamp = await oracle.latestTimestamp();
            expect(timestamp).to.be.greaterThan(0n);
        });
    });

    describe("VRF Functionality", function () {
        it("Should request and fulfill randomness", async function () {
            // Request randomness
            await expect(oracle.connect(requester).requestRandomness("test-seed"))
                .to.emit(oracle, "RandomnessRequested");

            // Fulfill randomness
            const randomValue = 12345678901234567890n;
            await expect(oracle.connect(node1).fulfillRandomness(0, randomValue, "0x"))
                .to.emit(oracle, "RandomnessFulfilled")
                .withArgs(0, randomValue);

            // Check request is resolved
            const req = await oracle.randomnessRequests(0);
            expect(req.resolved).to.be.true;
            expect(req.randomness).to.equal(randomValue);
        });

        it("Should reward node for VRF fulfillment", async function () {
            await oracle.connect(requester).requestRandomness("test-seed");

            const rewardBefore = await oracle.nodeRewards(node1.address);
            await oracle.connect(node1).fulfillRandomness(0, 12345n, "0x");
            const rewardAfter = await oracle.nodeRewards(node1.address);

            expect(rewardAfter).to.be.greaterThan(rewardBefore);
        });
    });

    describe("OEV (Oracle Extractable Value)", function () {
        it("Should allow OEV-enabled requests", async function () {
            await expect(oracle.connect(requester).requestDataOEV(
                "api.com/price",
                0,
                1000,
                "meta",
                requester.address
            )).to.emit(oracle, "RequestData");
        });
    });

    describe("Optimistic Mode", function () {
        it("Should allow optimistic fulfillment", async function () {
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");

            await expect(oracle.connect(node1).fulfillDataOptimistic(0, 38500000000n))
                .to.emit(oracle, "OptimisticFulfillment");
        });

        it("Should have challenge window for optimistic fulfillments", async function () {
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
            await oracle.connect(node1).fulfillDataOptimistic(0, 38500000000n);

            const req = await oracle.requests(0);
            expect(req.isOptimistic).to.be.true;
            expect(req.challengeWindow).to.be.greaterThan(0n);
        });
    });

    describe("Multi-Oracle Aggregation", function () {
        it("Should correctly aggregate 3 oracle responses with median", async function () {
            await oracle.setMinResponses(3);
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");

            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);

            // Values: 100, 200, 150 -> Median should be 150
            await oracle.connect(node1).fulfillData(0, 100, proof, pubInputs);
            await oracle.connect(node2).fulfillData(0, 200, proof, pubInputs);
            await oracle.connect(node3).fulfillData(0, 150, proof, pubInputs);

            const req = await oracle.requests(0);
            expect(req.finalValue).to.equal(150n);
        });

        it("Should emit NewRound event on aggregation", async function () {
            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");

            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);

            await expect(oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs))
                .to.emit(oracle, "NewRound");
        });
    });

    describe("Persistent Rounds", function () {
        it("Should increment round IDs correctly", async function () {
            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);

            // Round 1
            await oracle.connect(requester).requestData("api.com/eth", 0, 1000, "meta");
            await oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs);

            // Round 2
            await oracle.connect(requester).requestData("api.com/btc", 0, 100000, "meta");
            await oracle.connect(node1).fulfillData(1, 9700000000000n, proof, pubInputs);

            // Round 3
            await oracle.connect(requester).requestData("api.com/link", 0, 50, "meta");
            await oracle.connect(node1).fulfillData(2, 1400000000n, proof, pubInputs);

            const latestRoundId = await oracle.latestRoundId();
            expect(latestRoundId).to.equal(3n);
        });

        it("Should store correct round data", async function () {
            const proof = Array(8).fill(0);
            const pubInputs = Array(2).fill(0);

            await oracle.connect(requester).requestData("api.com/price", 0, 1000, "meta");
            await oracle.connect(node1).fulfillData(0, 38500000000n, proof, pubInputs);

            const round = await oracle.rounds(1);
            expect(round.roundId).to.equal(1n);
            expect(round.answer).to.equal(38500000000n);
            expect(round.startedAt).to.be.greaterThan(0n);
            expect(round.updatedAt).to.be.greaterThan(0n);
        });
    });
});
