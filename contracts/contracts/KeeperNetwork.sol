// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ObscuraToken.sol";

/**
 * @title KeeperNetwork
 * @notice Decentralized automation network for executing tasks
 * @dev Similar to Chainlink Keepers/Automation - nodes compete to execute upkeeps
 */
contract KeeperNetwork is Ownable, ReentrancyGuard {
    // Upkeep (task) definition
    struct Upkeep {
        uint256 id;
        address owner;
        address target; // Contract to call
        bytes checkData; // Data for checkUpkeep
        bytes performData; // Data for performUpkeep
        uint256 gasLimit;
        uint256 balance; // OBSCURA balance for payment
        uint256 minBalance; // Minimum balance before pausing
        uint256 lastPerformTime;
        uint256 interval; // Minimum time between performs
        bool active;
        bool paused;
    }

    // Keeper (node) information
    struct Keeper {
        address operator;
        uint256 stakedAmount;
        uint256 jobsPerformed;
        uint256 totalEarned;
        uint256 lastActiveTime;
        bool active;
    }

    // State
    ObscuraToken public token;
    mapping(uint256 => Upkeep) public upkeeps;
    mapping(address => Keeper) public keepers;
    address[] public keeperList;
    uint256 public upkeepCount;

    // Configuration
    uint256 public minKeeperStake;
    uint256 public paymentPerGas; // Payment per gas unit used
    uint256 public registrationFee; // Fee to register an upkeep
    uint256 public maxGasLimit; // Maximum gas limit per upkeep

    // Round-robin keeper selection
    uint256 public currentKeeperIndex;

    // Events
    event UpkeepRegistered(
        uint256 indexed id,
        address indexed owner,
        address target
    );
    event UpkeepPerformed(
        uint256 indexed id,
        address indexed keeper,
        uint256 gasUsed,
        uint256 payment
    );
    event UpkeepFunded(uint256 indexed id, uint256 amount);
    event UpkeepPaused(uint256 indexed id);
    event UpkeepResumed(uint256 indexed id);
    event UpkeepCancelled(uint256 indexed id, uint256 refund);
    event KeeperRegistered(address indexed keeper, uint256 stakedAmount);
    event KeeperDeactivated(address indexed keeper);
    event KeeperPaid(address indexed keeper, uint256 amount);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        token = ObscuraToken(_token);

        // Default configuration
        minKeeperStake = 5000 * 10 ** 18; // 5,000 OBSCURA
        paymentPerGas = 1e12; // 0.000001 OBSCURA per gas
        registrationFee = 100 * 10 ** 18; // 100 OBSCURA registration fee
        maxGasLimit = 5000000; // 5M gas max
    }

    // ============ UPKEEP MANAGEMENT ============

    /**
     * @notice Register a new upkeep
     */
    function registerUpkeep(
        address target,
        uint256 gasLimit,
        bytes calldata checkData,
        uint256 interval
    ) external returns (uint256 upkeepId) {
        require(gasLimit <= maxGasLimit, "Gas limit too high");
        require(target != address(0), "Invalid target");

        // Collect registration fee
        require(
            token.transferFrom(msg.sender, address(this), registrationFee),
            "Fee transfer failed"
        );

        upkeepCount++;
        upkeepId = upkeepCount;

        upkeeps[upkeepId] = Upkeep({
            id: upkeepId,
            owner: msg.sender,
            target: target,
            checkData: checkData,
            performData: "",
            gasLimit: gasLimit,
            balance: 0,
            minBalance: gasLimit * paymentPerGas * 10, // 10 executions worth
            lastPerformTime: 0,
            interval: interval,
            active: true,
            paused: false
        });

        emit UpkeepRegistered(upkeepId, msg.sender, target);
        return upkeepId;
    }

    /**
     * @notice Fund an upkeep
     */
    function fundUpkeep(uint256 upkeepId, uint256 amount) external {
        require(upkeeps[upkeepId].id != 0, "Upkeep not found");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        upkeeps[upkeepId].balance += amount;

        // Resume if was paused due to low balance
        if (
            upkeeps[upkeepId].paused &&
            upkeeps[upkeepId].balance >= upkeeps[upkeepId].minBalance
        ) {
            upkeeps[upkeepId].paused = false;
            emit UpkeepResumed(upkeepId);
        }

        emit UpkeepFunded(upkeepId, amount);
    }

    /**
     * @notice Pause an upkeep
     */
    function pauseUpkeep(uint256 upkeepId) external {
        require(upkeeps[upkeepId].owner == msg.sender, "Not owner");
        upkeeps[upkeepId].paused = true;
        emit UpkeepPaused(upkeepId);
    }

    /**
     * @notice Resume a paused upkeep
     */
    function resumeUpkeep(uint256 upkeepId) external {
        require(upkeeps[upkeepId].owner == msg.sender, "Not owner");
        require(
            upkeeps[upkeepId].balance >= upkeeps[upkeepId].minBalance,
            "Insufficient balance"
        );
        upkeeps[upkeepId].paused = false;
        emit UpkeepResumed(upkeepId);
    }

    /**
     * @notice Cancel an upkeep and refund remaining balance
     */
    function cancelUpkeep(uint256 upkeepId) external nonReentrant {
        Upkeep storage upkeep = upkeeps[upkeepId];
        require(upkeep.owner == msg.sender, "Not owner");

        uint256 refund = upkeep.balance;
        upkeep.balance = 0;
        upkeep.active = false;

        if (refund > 0) {
            require(token.transfer(msg.sender, refund), "Refund failed");
        }

        emit UpkeepCancelled(upkeepId, refund);
    }

    // ============ KEEPER MANAGEMENT ============

    /**
     * @notice Register as a keeper
     */
    function registerKeeper() external nonReentrant {
        require(
            keepers[msg.sender].operator == address(0),
            "Already registered"
        );
        require(
            token.transferFrom(msg.sender, address(this), minKeeperStake),
            "Stake transfer failed"
        );

        keepers[msg.sender] = Keeper({
            operator: msg.sender,
            stakedAmount: minKeeperStake,
            jobsPerformed: 0,
            totalEarned: 0,
            lastActiveTime: block.timestamp,
            active: true
        });

        keeperList.push(msg.sender);

        emit KeeperRegistered(msg.sender, minKeeperStake);
    }

    /**
     * @notice Add more stake as a keeper
     */
    function addStake(uint256 amount) external nonReentrant {
        require(keepers[msg.sender].operator != address(0), "Not a keeper");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        keepers[msg.sender].stakedAmount += amount;
    }

    /**
     * @notice Deactivate as a keeper
     */
    function deactivateKeeper() external nonReentrant {
        Keeper storage keeper = keepers[msg.sender];
        require(keeper.operator != address(0), "Not a keeper");
        require(keeper.active, "Already inactive");

        keeper.active = false;

        // Return stake
        uint256 stake = keeper.stakedAmount;
        keeper.stakedAmount = 0;
        require(token.transfer(msg.sender, stake), "Stake return failed");

        emit KeeperDeactivated(msg.sender);
    }

    // ============ UPKEEP EXECUTION ============

    /**
     * @notice Check if upkeep is needed (called off-chain)
     */
    function checkUpkeep(
        uint256 upkeepId
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
        Upkeep storage upkeep = upkeeps[upkeepId];

        if (!upkeep.active || upkeep.paused) {
            return (false, "");
        }

        if (upkeep.balance < upkeep.gasLimit * paymentPerGas) {
            return (false, "");
        }

        if (block.timestamp < upkeep.lastPerformTime + upkeep.interval) {
            return (false, "");
        }

        // Call the target's checkUpkeep function
        try
            IKeeperCompatible(upkeep.target).checkUpkeep(upkeep.checkData)
        returns (bool needed, bytes memory data) {
            return (needed, data);
        } catch {
            return (false, "");
        }
    }

    /**
     * @notice Perform the upkeep (called by keepers)
     */
    function performUpkeep(
        uint256 upkeepId,
        bytes calldata performData
    ) external nonReentrant {
        Keeper storage keeper = keepers[msg.sender];
        require(keeper.active, "Not an active keeper");

        Upkeep storage upkeep = upkeeps[upkeepId];
        require(upkeep.active && !upkeep.paused, "Upkeep not active");
        require(
            upkeep.balance >= upkeep.gasLimit * paymentPerGas,
            "Insufficient balance"
        );
        require(
            block.timestamp >= upkeep.lastPerformTime + upkeep.interval,
            "Too soon"
        );

        uint256 gasStart = gasleft();

        // Perform the upkeep
        try IKeeperCompatible(upkeep.target).performUpkeep(performData) {
            // Success
        } catch {
            // Still pay keeper for gas used
        }
        uint256 gasUsed = gasStart - gasleft();
        uint256 payment = gasUsed * paymentPerGas;

        // Ensure we don't pay more than balance
        if (payment > upkeep.balance) {
            payment = upkeep.balance;
        }

        upkeep.balance -= payment;
        upkeep.lastPerformTime = block.timestamp;

        // Pause if low balance
        if (upkeep.balance < upkeep.minBalance) {
            upkeep.paused = true;
            emit UpkeepPaused(upkeepId);
        }

        // Pay keeper
        keeper.jobsPerformed++;
        keeper.totalEarned += payment;
        keeper.lastActiveTime = block.timestamp;
        require(token.transfer(msg.sender, payment), "Payment failed");

        emit UpkeepPerformed(upkeepId, msg.sender, gasUsed, payment);
        emit KeeperPaid(msg.sender, payment);
    }

    // ============ VIEW FUNCTIONS ============

    function getUpkeep(
        uint256 upkeepId
    )
        external
        view
        returns (
            address owner,
            address target,
            uint256 gasLimit,
            uint256 balance,
            uint256 lastPerformTime,
            bool active,
            bool paused
        )
    {
        Upkeep storage u = upkeeps[upkeepId];
        return (
            u.owner,
            u.target,
            u.gasLimit,
            u.balance,
            u.lastPerformTime,
            u.active,
            u.paused
        );
    }

    function getKeeperInfo(
        address keeperAddress
    )
        external
        view
        returns (
            uint256 stakedAmount,
            uint256 jobsPerformed,
            uint256 totalEarned,
            bool active
        )
    {
        Keeper storage k = keepers[keeperAddress];
        return (k.stakedAmount, k.jobsPerformed, k.totalEarned, k.active);
    }

    function getActiveKeepers() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < keeperList.length; i++) {
            if (keepers[keeperList[i]].active) {
                activeCount++;
            }
        }

        address[] memory active = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < keeperList.length; i++) {
            if (keepers[keeperList[i]].active) {
                active[idx] = keeperList[i];
                idx++;
            }
        }
        return active;
    }

    function getActiveUpkeepCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= upkeepCount; i++) {
            if (upkeeps[i].active && !upkeeps[i].paused) {
                count++;
            }
        }
    }

    // ============ ADMIN FUNCTIONS ============

    function setMinKeeperStake(uint256 amount) external onlyOwner {
        minKeeperStake = amount;
    }

    function setPaymentPerGas(uint256 amount) external onlyOwner {
        paymentPerGas = amount;
    }

    function setRegistrationFee(uint256 amount) external onlyOwner {
        registrationFee = amount;
    }

    function setMaxGasLimit(uint256 limit) external onlyOwner {
        maxGasLimit = limit;
    }
}

/**
 * @notice Interface for keeper-compatible contracts
 */
interface IKeeperCompatible {
    function checkUpkeep(
        bytes calldata checkData
    ) external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}
