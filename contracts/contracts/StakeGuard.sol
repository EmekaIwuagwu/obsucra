// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakeGuard
 * @dev Cryptoeconomic security layer for Obscura Network.
 * Handles node operator staking, reputation, and slashing.
 */
contract StakeGuard is Ownable, ReentrancyGuard {
    IERC20 public immutable obscuraToken;

    struct Staker {
        uint256 balance;
        uint256 lastStakeTime;
        uint256 reputation;
        bool isActive;
    }

    mapping(address => Staker) public stakers;
    mapping(address => bool) public slashers;
    uint256 public totalStaked;
    uint256 public constant MIN_STAKE = 100 * 10**18; // 100 OBSCURA
    uint256 public constant UNBONDING_PERIOD = 7 days;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Slashed(address indexed node, uint256 amount, string reason);

    constructor(address _token) Ownable(msg.sender) {
        obscuraToken = IERC20(_token);
    }

    function stake(uint256 _amount) external nonReentrant {
        require(_amount >= MIN_STAKE, "Stake below minimum");
        
        obscuraToken.transferFrom(msg.sender, address(this), _amount);
        
        Staker storage s = stakers[msg.sender];
        s.balance += _amount;
        s.lastStakeTime = block.timestamp;
        s.isActive = true;
        s.reputation += 10; // Initial reputation boost

        totalStaked += _amount;
        emit Staked(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external nonReentrant {
        Staker storage s = stakers[msg.sender];
        require(s.balance >= _amount, "Insufficient balance");
        require(block.timestamp >= s.lastStakeTime + UNBONDING_PERIOD, "Unbonding period not over");

        s.balance -= _amount;
        totalStaked -= _amount;
        
        if (s.balance == 0) {
            s.isActive = false;
        }

        obscuraToken.transfer(msg.sender, _amount);
        emit Unstaked(msg.sender, _amount);
    }

    modifier onlySlasher() {
        require(msg.sender == owner() || slashers[msg.sender], "Not authorized to slash");
        _;
    }

    function setSlasher(address _slasher, bool _status) external onlyOwner {
        slashers[_slasher] = _status;
    }

    /**
     * @dev Slashing mechanism for malicious nodes (called by governance or oracle core)
     */
    function slash(address _node, uint256 _amount, string calldata _reason) external onlySlasher {
        Staker storage s = stakers[_node];
        require(s.balance >= _amount, "Slashing more than balance");

        s.balance -= _amount;
        totalStaked -= _amount;
        s.reputation = s.reputation > 50 ? s.reputation - 50 : 0;

        // Slashed funds could be burned or moved to an insurance pool
        obscuraToken.transfer(owner(), _amount); 
        
        emit Slashed(_node, _amount, _reason);
    }

    function getReputation(address _node) external view returns (uint256) {
        return stakers[_node].reputation;
    }

    /**
     * @dev Adjust reputation score without slashing funds (for minor infractions or successful jobs)
     */
    function updateReputation(address _node, int256 _delta) external onlySlasher {
        Staker storage s = stakers[_node];
        if (_delta > 0) {
            s.reputation += uint256(_delta);
        } else {
            uint256 absDelta = uint256(-_delta);
            s.reputation = s.reputation > absDelta ? s.reputation - absDelta : 0;
        }
    }
}
