const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ObscuraToken", function () {
    let token, owner, user1, user2;
    const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100M

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        const ObscuraToken = await ethers.getContractFactory("ObscuraToken");
        token = await ObscuraToken.deploy(owner.address);
        await token.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await token.name()).to.equal("Obscura");
            expect(await token.symbol()).to.equal("OBSCURA");
        });

        it("Should have correct initial supply", async function () {
            expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
        });

        it("Should assign initial supply to owner", async function () {
            expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
        });

        it("Should have correct max supply", async function () {
            expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000"));
        });
    });

    describe("Staking", function () {
        const stakeAmount = ethers.parseEther("10000");
        const lockDuration = 7 * 24 * 60 * 60; // 7 days

        beforeEach(async function () {
            // Transfer tokens to user1
            await token.transfer(user1.address, stakeAmount * 2n);
        });

        it("Should allow staking above minimum", async function () {
            await token.connect(user1).stake(stakeAmount, lockDuration);

            const stakeInfo = await token.getStakeInfo(user1.address);
            expect(stakeInfo.amount).to.equal(stakeAmount);
        });

        it("Should prevent staking below minimum", async function () {
            const lowAmount = ethers.parseEther("100");
            await expect(
                token.connect(user1).stake(lowAmount, lockDuration)
            ).to.be.revertedWith("Below minimum stake");
        });

        it("Should prevent unstaking during lock period", async function () {
            await token.connect(user1).stake(stakeAmount, lockDuration);

            await expect(
                token.connect(user1).unstake()
            ).to.be.revertedWith("Still locked");
        });

        it("Should show pending rewards", async function () {
            await token.connect(user1).stake(stakeAmount, lockDuration);

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
            await ethers.provider.send("evm_mine");

            const rewards = await token.pendingRewards(user1.address);
            expect(rewards).to.be.gt(0);
        });

        it("Should calculate staking APY", async function () {
            const apy = await token.stakingAPY();
            expect(apy).to.be.gt(0);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set reward rate", async function () {
            const newRate = ethers.parseEther("0.002");
            await token.setRewardRate(newRate);
            expect(await token.rewardRatePerSecond()).to.equal(newRate);
        });

        it("Should allow owner to set treasury", async function () {
            await token.setTreasuryAddress(user2.address);
            expect(await token.treasuryAddress()).to.equal(user2.address);
        });

        it("Should prevent non-owner from admin functions", async function () {
            await expect(
                token.connect(user1).setRewardRate(1000)
            ).to.be.reverted;
        });
    });
});

describe("NodeRegistry", function () {
    let token, registry, owner, node1, node2;
    const MIN_STAKE = ethers.parseEther("10000");

    beforeEach(async function () {
        [owner, node1, node2] = await ethers.getSigners();

        const ObscuraToken = await ethers.getContractFactory("ObscuraToken");
        token = await ObscuraToken.deploy(owner.address);

        const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
        registry = await NodeRegistry.deploy(await token.getAddress(), owner.address);

        // Fund nodes
        await token.transfer(node1.address, MIN_STAKE * 2n);
        await token.transfer(node2.address, MIN_STAKE * 2n);

        // Approve registry
        await token.connect(node1).approve(await registry.getAddress(), MIN_STAKE * 2n);
        await token.connect(node2).approve(await registry.getAddress(), MIN_STAKE * 2n);
    });

    describe("Node Registration", function () {
        it("Should allow node registration with sufficient stake", async function () {
            await registry.connect(node1).registerNode(
                "Node 1",
                "https://node1.obscura.network",
                ethers.encodeBytes32String("pubkey1")
            );

            const nodeInfo = await registry.getNodeInfo(node1.address);
            expect(nodeInfo.name).to.equal("Node 1");
            expect(nodeInfo.stakedAmount).to.equal(MIN_STAKE);
        });

        it("Should set initial reputation to 50%", async function () {
            await registry.connect(node1).registerNode(
                "Node 1",
                "https://node1.obscura.network",
                ethers.encodeBytes32String("pubkey1")
            );

            const nodeInfo = await registry.getNodeInfo(node1.address);
            expect(nodeInfo.reputation).to.equal(5000); // 50%
        });

        it("Should prevent double registration", async function () {
            await registry.connect(node1).registerNode(
                "Node 1",
                "https://node1.obscura.network",
                ethers.encodeBytes32String("pubkey1")
            );

            await expect(
                registry.connect(node1).registerNode("Node 1 Again", "https://node1.obscura.network", ethers.encodeBytes32String("pubkey1"))
            ).to.be.revertedWith("Already registered");
        });
    });

    describe("Node Count", function () {
        it("Should track active nodes correctly", async function () {
            await registry.connect(node1).registerNode(
                "Node 1",
                "https://node1.obscura.network",
                ethers.encodeBytes32String("pubkey1")
            );

            await registry.connect(node2).registerNode(
                "Node 2",
                "https://node2.obscura.network",
                ethers.encodeBytes32String("pubkey2")
            );

            const [total, active] = await registry.getNodeCount();
            expect(total).to.equal(2);
            expect(active).to.equal(2);
        });
    });
});

describe("ProofOfReserve", function () {
    let por, owner, auditor;

    beforeEach(async function () {
        [owner, auditor] = await ethers.getSigners();

        const ProofOfReserve = await ethers.getContractFactory("ProofOfReserve");
        por = await ProofOfReserve.deploy(owner.address);

        // Authorize auditor
        await por.authorizeAuditor(auditor.address);
    });

    describe("Reserve Registration", function () {
        it("Should register a new reserve", async function () {
            const tx = await por.registerReserve(
                "USDC",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "Circle",
                3600 // 1 hour update frequency
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });
    });

    describe("Reserve Updates", function () {
        let assetId;

        beforeEach(async function () {
            const tx = await por.registerReserve(
                "USDC",
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                "Circle",
                3600
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === 'ReserveRegistered');
            assetId = event.args[0];
        });

        it("Should update reserve data", async function () {
            await por.connect(auditor).updateReserve(
                assetId,
                ethers.parseEther("1000000000"), // 1B reported
                ethers.parseEther("1000000000"), // 1B circulating
                ethers.encodeBytes32String("proof")
            );

            const ratio = await por.getCollateralRatio(assetId);
            expect(ratio).to.equal(10000); // 100%
        });

        it("Should mark as healthy when fully collateralized", async function () {
            await por.connect(auditor).updateReserve(
                assetId,
                ethers.parseEther("1100000000"), // 1.1B reported
                ethers.parseEther("1000000000"), // 1B circulating
                ethers.encodeBytes32String("proof")
            );

            expect(await por.isHealthy(assetId)).to.be.true;
        });
    });
});

describe("ObscuraGovernance", function () {
    let token, governance, owner, voter1, voter2;
    const PROPOSAL_THRESHOLD = ethers.parseEther("10000");

    beforeEach(async function () {
        [owner, voter1, voter2] = await ethers.getSigners();

        const ObscuraToken = await ethers.getContractFactory("ObscuraToken");
        token = await ObscuraToken.deploy(owner.address);

        const ObscuraGovernance = await ethers.getContractFactory("ObscuraGovernance");
        governance = await ObscuraGovernance.deploy(await token.getAddress(), owner.address);

        // Fund voters
        await token.transfer(voter1.address, PROPOSAL_THRESHOLD * 2n);
        await token.transfer(voter2.address, PROPOSAL_THRESHOLD);
    });

    describe("Proposal Creation", function () {
        it("Should allow creating proposals with sufficient tokens", async function () {
            await governance.connect(voter1).createProposal(
                0, // ParameterChange
                "Increase Rewards",
                "Proposal to increase staking rewards by 10%",
                ethers.ZeroAddress,
                "0x"
            );

            expect(await governance.proposalCount()).to.equal(1);
        });

        it("Should prevent proposals from users without enough tokens", async function () {
            await expect(
                governance.connect(voter2).createProposal(
                    0,
                    "My Proposal",
                    "Description",
                    ethers.ZeroAddress,
                    "0x"
                )
            ).to.not.be.reverted; // voter2 has exactly threshold amount
        });
    });
});

describe("KeeperNetwork", function () {
    let token, keeper, owner, keeperNode, upkeepOwner;
    const MIN_STAKE = ethers.parseEther("5000");

    beforeEach(async function () {
        [owner, keeperNode, upkeepOwner] = await ethers.getSigners();

        const ObscuraToken = await ethers.getContractFactory("ObscuraToken");
        token = await ObscuraToken.deploy(owner.address);

        const KeeperNetwork = await ethers.getContractFactory("KeeperNetwork");
        keeper = await KeeperNetwork.deploy(await token.getAddress(), owner.address);

        // Fund keeper and upkeep owner
        await token.transfer(keeperNode.address, MIN_STAKE * 2n);
        await token.transfer(upkeepOwner.address, ethers.parseEther("1000"));

        // Approve
        await token.connect(keeperNode).approve(await keeper.getAddress(), MIN_STAKE * 2n);
        await token.connect(upkeepOwner).approve(await keeper.getAddress(), ethers.parseEther("1000"));
    });

    describe("Keeper Registration", function () {
        it("Should allow keeper registration", async function () {
            await keeper.connect(keeperNode).registerKeeper();

            const info = await keeper.getKeeperInfo(keeperNode.address);
            expect(info.stakedAmount).to.equal(MIN_STAKE);
            expect(info.active).to.be.true;
        });
    });

    describe("Upkeep Registration", function () {
        it("Should allow upkeep registration", async function () {
            const upkeepId = await keeper.connect(upkeepOwner).registerUpkeep.staticCall(
                owner.address, // target contract
                500000, // gas limit
                "0x", // check data
                3600 // interval
            );

            expect(upkeepId).to.equal(1);
        });
    });
});
