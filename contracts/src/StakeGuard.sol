// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakeGuard is Ownable {
    IERC20 public token;

    struct Stake {
        uint256 amount;
        uint256 timestamp;
        uint256 lockPeriod;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount, uint256 lockPeriod);
    event Unstaked(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function stake(uint256 _amount, uint256 _lockPeriod) external {
        require(_amount > 0, "Cannot stake 0");
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        stakes[msg.sender].amount += _amount;
        stakes[msg.sender].timestamp = block.timestamp;
        stakes[msg.sender].lockPeriod = _lockPeriod;
        
        totalStaked += _amount;

        emit Staked(msg.sender, _amount, _lockPeriod);
    }

    function unstake() external {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No stake");
        require(block.timestamp >= userStake.timestamp + userStake.lockPeriod, "Stake locked");

        uint256 amount = userStake.amount;
        userStake.amount = 0;
        totalStaked -= amount;

        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    function slash(address _user, uint256 _amount) external onlyOwner {
        Stake storage userStake = stakes[_user];
        require(userStake.amount >= _amount, "Insufficient stake to slash");

        userStake.amount -= _amount;
        totalStaked -= _amount;
        
        // Burn or move to treasury (here we just remove from user)
        // In real impl: token.transfer(treasury, _amount);

        emit Slashed(_user, _amount);
    }
}
