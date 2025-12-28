const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StakeGuard Production Tests", function () {
    let stakeGuard, token;
    let owner, node1, node2, slasher;
    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const MIN_STAKE = ethers.parseEther("100");

    beforeEach(async function () {
        [owner, node1, node2, slasher] = await ethers.getSigners();

        // Deploy Token (new constructor takes owner address)
        const ObscuraToken = await ethers.getContractFactory("ObscuraToken");
        token = await ObscuraToken.deploy(owner.address);
        await token.waitForDeployment();

        // Deploy StakeGuard
        const StakeGuard = await ethers.getContractFactory("StakeGuard");
        stakeGuard = await StakeGuard.deploy(await token.getAddress());
        await stakeGuard.waitForDeployment();

        // Setup slasher role
        const SLASHER_ROLE = await stakeGuard.SLASHER_ROLE();
        await stakeGuard.grantRole(SLASHER_ROLE, slasher.address);

        // Fund nodes
        await token.transfer(node1.address, ethers.parseEther("500"));
        await token.transfer(node2.address, ethers.parseEther("500"));
    });

    it("Should allow staking above minimum", async function () {
        await token.connect(node1).approve(await stakeGuard.getAddress(), MIN_STAKE);

        await expect(stakeGuard.connect(node1).stake(MIN_STAKE))
            .to.emit(stakeGuard, "Staked")
            .withArgs(node1.address, MIN_STAKE);

        const staker = await stakeGuard.stakers(node1.address);
        expect(staker.balance).to.equal(MIN_STAKE);
        expect(staker.isActive).to.be.true;
        expect(staker.reputation).to.equal(10); // Initial reputation boost
    });

    it("Should reject staking below minimum", async function () {
        const belowMin = ethers.parseEther("50");
        await token.connect(node1).approve(await stakeGuard.getAddress(), belowMin);

        await expect(stakeGuard.connect(node1).stake(belowMin))
            .to.be.revertedWith("Stake below minimum");
    });

    it("Should enforce unbonding period for unstaking", async function () {
        await token.connect(node1).approve(await stakeGuard.getAddress(), MIN_STAKE);
        await stakeGuard.connect(node1).stake(MIN_STAKE);

        // Try to unstake immediately
        await expect(stakeGuard.connect(node1).unstake(MIN_STAKE))
            .to.be.revertedWith("Unbonding period not over");

        // Fast forward 7 days
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600]);
        await ethers.provider.send("evm_mine");

        // Now unstaking should work
        await expect(stakeGuard.connect(node1).unstake(MIN_STAKE))
            .to.emit(stakeGuard, "Unstaked")
            .withArgs(node1.address, MIN_STAKE);

        const staker = await stakeGuard.stakers(node1.address);
        expect(staker.balance).to.equal(0);
        expect(staker.isActive).to.be.false;
    });

    it("Should allow slasher to slash malicious nodes", async function () {
        await token.connect(node1).approve(await stakeGuard.getAddress(), MIN_STAKE);
        await stakeGuard.connect(node1).stake(MIN_STAKE);

        const slashAmount = ethers.parseEther("10");
        const startBalance = (await stakeGuard.stakers(node1.address)).balance;

        await expect(stakeGuard.connect(slasher).slash(node1.address, slashAmount, "Price deviation"))
            .to.emit(stakeGuard, "Slashed")
            .withArgs(node1.address, slashAmount, "Price deviation");

        const endBalance = (await stakeGuard.stakers(node1.address)).balance;
        expect(startBalance - endBalance).to.equal(slashAmount);

        // Check reputation was reduced
        const staker = await stakeGuard.stakers(node1.address);
        expect(staker.reputation).to.be.lessThan(10);
    });

    it("Should prevent non-slasher from slashing", async function () {
        await token.connect(node1).approve(await stakeGuard.getAddress(), MIN_STAKE);
        await stakeGuard.connect(node1).stake(MIN_STAKE);

        const slashAmount = ethers.parseEther("10");

        await expect(stakeGuard.connect(node2).slash(node1.address, slashAmount, "Unauthorized"))
            .to.be.reverted; // Will revert with AccessControl error
    });

    it("Should update reputation correctly", async function () {
        await token.connect(node1).approve(await stakeGuard.getAddress(), MIN_STAKE);
        await stakeGuard.connect(node1).stake(MIN_STAKE);

        // Increase reputation
        await stakeGuard.connect(slasher).updateReputation(node1.address, 50);
        let staker = await stakeGuard.stakers(node1.address);
        expect(staker.reputation).to.equal(60); // 10 initial + 50

        // Decrease reputation
        await stakeGuard.connect(slasher).updateReputation(node1.address, -30);
        staker = await stakeGuard.stakers(node1.address);
        expect(staker.reputation).to.equal(30); // 60 - 30
    });

    it("Should track total staked correctly", async function () {
        await token.connect(node1).approve(await stakeGuard.getAddress(), MIN_STAKE);
        await token.connect(node2).approve(await stakeGuard.getAddress(), MIN_STAKE);

        await stakeGuard.connect(node1).stake(MIN_STAKE);
        expect(await stakeGuard.totalStaked()).to.equal(MIN_STAKE);

        await stakeGuard.connect(node2).stake(MIN_STAKE);
        expect(await stakeGuard.totalStaked()).to.equal(MIN_STAKE * 2n);

        // Fast forward and unstake
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600]);
        await ethers.provider.send("evm_mine");

        await stakeGuard.connect(node1).unstake(MIN_STAKE);
        expect(await stakeGuard.totalStaked()).to.equal(MIN_STAKE);
    });
});
