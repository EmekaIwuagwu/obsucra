// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ObscuraToken
 * @notice The native token of the Obscura Oracle Network
 * @dev ERC-20 token with staking, rewards, and governance capabilities
 */
contract ObscuraToken is
    ERC20,
    ERC20Burnable,
    ERC20Permit,
    Ownable,
    ReentrancyGuard
{
    // Token constants
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10 ** 18; // 100 million initial

    // Distribution allocations (percentages of MAX_SUPPLY)
    uint256 public constant NODE_REWARDS_ALLOCATION = 40; // 40% for node rewards
    uint256 public constant TEAM_ALLOCATION = 15; // 15% for team (vested)
    uint256 public constant ECOSYSTEM_ALLOCATION = 20; // 20% for ecosystem growth
    uint256 public constant COMMUNITY_ALLOCATION = 15; // 15% for community
    uint256 public constant TREASURY_ALLOCATION = 10; // 10% for treasury

    // Staking state
    struct Stake {
        uint256 amount;
        uint256 stakedAt;
        uint256 lockEndTime;
        uint256 rewardsAccrued;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    uint256 public rewardRatePerSecond; // Rewards per second per token staked
    uint256 public minStakeAmount;
    uint256 public minLockDuration;

    // Minting control
    uint256 public totalMinted;
    address public nodeRewardsPool;
    address public treasuryAddress;

    // Events
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event NodeRewardsPoolSet(address indexed pool);

    constructor(
        address initialOwner
    ) ERC20("Obscura", "OBSCURA") ERC20Permit("Obscura") Ownable(initialOwner) {
        // Mint initial supply to deployer
        _mint(initialOwner, INITIAL_SUPPLY);
        totalMinted = INITIAL_SUPPLY;

        // Set defaults
        rewardRatePerSecond = 1e15; // 0.001 token per second per staked token
        minStakeAmount = 1000 * 10 ** 18; // Minimum 1000 tokens to stake
        minLockDuration = 7 days;
    }

    // ============ STAKING FUNCTIONS ============

    /**
     * @notice Stake tokens to earn rewards and participate in network
     * @param amount Amount of tokens to stake
     * @param lockDuration How long to lock tokens (minimum 7 days)
     */
    function stake(uint256 amount, uint256 lockDuration) external nonReentrant {
        require(amount >= minStakeAmount, "Below minimum stake");
        require(lockDuration >= minLockDuration, "Lock duration too short");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Claim any pending rewards first
        if (stakes[msg.sender].amount > 0) {
            _claimRewards(msg.sender);
        }

        // Transfer tokens to contract
        _transfer(msg.sender, address(this), amount);

        // Update stake
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].stakedAt = block.timestamp;
        stakes[msg.sender].lockEndTime = block.timestamp + lockDuration;

        totalStaked += amount;

        emit Staked(msg.sender, amount, lockDuration);
    }

    /**
     * @notice Unstake tokens after lock period
     */
    function unstake() external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(block.timestamp >= userStake.lockEndTime, "Still locked");

        // Calculate final rewards
        uint256 rewards = _calculateRewards(msg.sender);
        uint256 amount = userStake.amount;

        // Reset stake
        totalStaked -= amount;
        userStake.amount = 0;
        userStake.rewardsAccrued = 0;

        // Transfer tokens back
        _transfer(address(this), msg.sender, amount);

        // Mint rewards if available
        if (rewards > 0 && totalMinted + rewards <= MAX_SUPPLY) {
            _mint(msg.sender, rewards);
            totalMinted += rewards;
        }

        emit Unstaked(msg.sender, amount, rewards);
    }

    /**
     * @notice Claim accrued staking rewards without unstaking
     */
    function claimRewards() external nonReentrant {
        require(stakes[msg.sender].amount > 0, "No stake found");
        _claimRewards(msg.sender);
    }

    function _claimRewards(address user) internal {
        uint256 rewards = _calculateRewards(user);
        if (rewards > 0 && totalMinted + rewards <= MAX_SUPPLY) {
            stakes[user].rewardsAccrued = 0;
            stakes[user].stakedAt = block.timestamp;
            _mint(user, rewards);
            totalMinted += rewards;
            emit RewardsClaimed(user, rewards);
        }
    }

    function _calculateRewards(address user) internal view returns (uint256) {
        Stake storage userStake = stakes[user];
        if (userStake.amount == 0) return 0;

        uint256 stakeDuration = block.timestamp - userStake.stakedAt;
        uint256 rewards = (userStake.amount *
            rewardRatePerSecond *
            stakeDuration) / 1e18;
        return rewards + userStake.rewardsAccrued;
    }

    /**
     * @notice Get pending rewards for a user
     */
    function pendingRewards(address user) external view returns (uint256) {
        return _calculateRewards(user);
    }

    /**
     * @notice Get stake info for a user
     */
    function getStakeInfo(
        address user
    )
        external
        view
        returns (
            uint256 amount,
            uint256 stakedAt,
            uint256 lockEndTime,
            uint256 pendingReward
        )
    {
        Stake storage userStake = stakes[user];
        return (
            userStake.amount,
            userStake.stakedAt,
            userStake.lockEndTime,
            _calculateRewards(user)
        );
    }

    // ============ NODE REWARDS ============

    /**
     * @notice Mint rewards for node operators (called by rewards pool)
     */
    function mintNodeRewards(address node, uint256 amount) external {
        require(msg.sender == nodeRewardsPool, "Only rewards pool");
        require(totalMinted + amount <= MAX_SUPPLY, "Exceeds max supply");

        _mint(node, amount);
        totalMinted += amount;
    }

    // ============ ADMIN FUNCTIONS ============

    function setNodeRewardsPool(address pool) external onlyOwner {
        nodeRewardsPool = pool;
        emit NodeRewardsPoolSet(pool);
    }

    function setRewardRate(uint256 rate) external onlyOwner {
        rewardRatePerSecond = rate;
        emit RewardRateUpdated(rate);
    }

    function setMinStakeAmount(uint256 amount) external onlyOwner {
        minStakeAmount = amount;
    }

    function setMinLockDuration(uint256 duration) external onlyOwner {
        minLockDuration = duration;
    }

    function setTreasuryAddress(address treasury) external onlyOwner {
        treasuryAddress = treasury;
    }

    /**
     * @notice Mint tokens to treasury (for ecosystem growth)
     */
    function mintToTreasury(uint256 amount) external onlyOwner {
        require(treasuryAddress != address(0), "Treasury not set");
        require(totalMinted + amount <= MAX_SUPPLY, "Exceeds max supply");

        _mint(treasuryAddress, amount);
        totalMinted += amount;
    }

    /**
     * @dev Legacy distribution function for backwards compatibility
     */
    function distributeFees(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Mismatched arrays");
        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
    }

    // ============ VIEW FUNCTIONS ============

    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    function stakingAPY() external view returns (uint256) {
        // Returns APY in basis points (e.g., 1000 = 10%)
        return (rewardRatePerSecond * 365 days * 10000) / 1e18;
    }
}
