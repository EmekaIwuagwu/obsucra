// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ObscuraToken.sol";

/**
 * @title NodeRegistry
 * @notice Manages decentralized node operators in the Obscura network
 * @dev Handles node registration, staking, reputation, and consensus participation
 */
contract NodeRegistry is Ownable, ReentrancyGuard {
    // Node status
    enum NodeStatus {
        Inactive,
        Active,
        Slashed,
        Unbonding
    }

    // Node information
    struct Node {
        address operator;
        string name;
        string endpoint; // API endpoint URL
        uint256 stakedAmount;
        uint256 reputation; // 0-10000 (100.00%)
        uint256 registeredAt;
        uint256 lastActivityAt;
        uint256 jobsCompleted;
        uint256 jobsFailed;
        NodeStatus status;
        bytes32 publicKey; // For P2P communication
    }

    // Consensus round
    struct ConsensusRound {
        bytes32 requestId;
        uint256 startTime;
        uint256 endTime;
        address[] participants;
        mapping(address => int256) submissions;
        mapping(address => bool) hasSubmitted;
        int256 finalValue;
        bool finalized;
    }

    // State
    ObscuraToken public token;
    mapping(address => Node) public nodes;
    address[] public nodeList;
    mapping(bytes32 => ConsensusRound) public consensusRounds;

    // Configuration
    uint256 public minStakeAmount;
    uint256 public unbondingPeriod;
    uint256 public slashPercentage; // In basis points (e.g., 1000 = 10%)
    uint256 public minNodesForConsensus;
    uint256 public consensusTimeout;
    uint256 public reputationDecayRate;

    // Rewards
    uint256 public baseRewardPerJob;
    uint256 public reputationBonus; // Extra reward for high reputation

    // Events
    event NodeRegistered(
        address indexed operator,
        string name,
        uint256 stakedAmount
    );
    event NodeUpdated(address indexed operator, string name, string endpoint);
    event NodeDeactivated(address indexed operator);
    event NodeSlashed(address indexed operator, uint256 amount, string reason);
    event StakeAdded(address indexed operator, uint256 amount);
    event StakeWithdrawn(address indexed operator, uint256 amount);
    event ConsensusStarted(bytes32 indexed requestId, address[] participants);
    event ValueSubmitted(
        bytes32 indexed requestId,
        address indexed node,
        int256 value
    );
    event ConsensusReached(bytes32 indexed requestId, int256 finalValue);
    event RewardPaid(address indexed node, uint256 amount);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        token = ObscuraToken(_token);

        // Default configuration
        minStakeAmount = 10000 * 10 ** 18; // 10,000 OBSCURA minimum
        unbondingPeriod = 14 days;
        slashPercentage = 1000; // 10%
        minNodesForConsensus = 3;
        consensusTimeout = 30 seconds;
        baseRewardPerJob = 10 * 10 ** 18; // 10 OBSCURA per job
        reputationBonus = 2 * 10 ** 18; // Up to 2 extra OBSCURA for max reputation
    }

    // ============ NODE MANAGEMENT ============

    /**
     * @notice Register as a node operator
     * @param name Display name for the node
     * @param endpoint API endpoint URL
     * @param publicKey Public key for P2P communication
     */
    function registerNode(
        string calldata name,
        string calldata endpoint,
        bytes32 publicKey
    ) external nonReentrant {
        require(nodes[msg.sender].operator == address(0), "Already registered");
        require(bytes(name).length > 0, "Name required");
        require(bytes(endpoint).length > 0, "Endpoint required");
        require(
            token.balanceOf(msg.sender) >= minStakeAmount,
            "Insufficient balance"
        );

        // Transfer stake
        require(
            token.transferFrom(msg.sender, address(this), minStakeAmount),
            "Transfer failed"
        );

        // Create node
        nodes[msg.sender] = Node({
            operator: msg.sender,
            name: name,
            endpoint: endpoint,
            stakedAmount: minStakeAmount,
            reputation: 5000, // Start at 50%
            registeredAt: block.timestamp,
            lastActivityAt: block.timestamp,
            jobsCompleted: 0,
            jobsFailed: 0,
            status: NodeStatus.Active,
            publicKey: publicKey
        });

        nodeList.push(msg.sender);

        emit NodeRegistered(msg.sender, name, minStakeAmount);
    }

    /**
     * @notice Update node information
     */
    function updateNode(
        string calldata name,
        string calldata endpoint
    ) external {
        require(nodes[msg.sender].operator != address(0), "Not registered");
        require(
            nodes[msg.sender].status == NodeStatus.Active,
            "Node not active"
        );

        nodes[msg.sender].name = name;
        nodes[msg.sender].endpoint = endpoint;

        emit NodeUpdated(msg.sender, name, endpoint);
    }

    /**
     * @notice Add more stake to increase reputation weight
     */
    function addStake(uint256 amount) external nonReentrant {
        require(nodes[msg.sender].operator != address(0), "Not registered");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        nodes[msg.sender].stakedAmount += amount;

        emit StakeAdded(msg.sender, amount);
    }

    /**
     * @notice Begin unbonding process to withdraw stake
     */
    function initiateUnbonding() external {
        Node storage node = nodes[msg.sender];
        require(node.operator != address(0), "Not registered");
        require(node.status == NodeStatus.Active, "Not active");

        node.status = NodeStatus.Unbonding;
        node.lastActivityAt = block.timestamp; // Use as unbonding start time

        emit NodeDeactivated(msg.sender);
    }

    /**
     * @notice Withdraw stake after unbonding period
     */
    function withdrawStake() external nonReentrant {
        Node storage node = nodes[msg.sender];
        require(node.status == NodeStatus.Unbonding, "Not unbonding");
        require(
            block.timestamp >= node.lastActivityAt + unbondingPeriod,
            "Still unbonding"
        );

        uint256 amount = node.stakedAmount;
        node.stakedAmount = 0;
        node.status = NodeStatus.Inactive;

        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit StakeWithdrawn(msg.sender, amount);
    }

    // ============ CONSENSUS ============

    /**
     * @notice Start a consensus round for a data request
     */
    function startConsensus(
        bytes32 requestId
    ) external returns (address[] memory participants) {
        require(consensusRounds[requestId].startTime == 0, "Round exists");

        // Select active nodes with sufficient reputation
        participants = _selectNodes();
        require(
            participants.length >= minNodesForConsensus,
            "Not enough nodes"
        );

        ConsensusRound storage round = consensusRounds[requestId];
        round.requestId = requestId;
        round.startTime = block.timestamp;
        round.endTime = block.timestamp + consensusTimeout;
        round.participants = participants;

        emit ConsensusStarted(requestId, participants);
        return participants;
    }

    /**
     * @notice Submit a value for consensus
     */
    function submitValue(bytes32 requestId, int256 value) external {
        ConsensusRound storage round = consensusRounds[requestId];
        require(round.startTime > 0, "Round not found");
        require(!round.finalized, "Already finalized");
        require(block.timestamp <= round.endTime, "Round expired");
        require(!round.hasSubmitted[msg.sender], "Already submitted");
        require(
            _isParticipant(round.participants, msg.sender),
            "Not a participant"
        );

        round.submissions[msg.sender] = value;
        round.hasSubmitted[msg.sender] = true;

        nodes[msg.sender].lastActivityAt = block.timestamp;

        emit ValueSubmitted(requestId, msg.sender, value);
    }

    /**
     * @notice Finalize consensus and calculate median
     */
    function finalizeConsensus(bytes32 requestId) external returns (int256) {
        ConsensusRound storage round = consensusRounds[requestId];
        require(round.startTime > 0, "Round not found");
        require(!round.finalized, "Already finalized");

        // Collect submitted values
        int256[] memory values = new int256[](round.participants.length);
        uint256 count = 0;

        for (uint256 i = 0; i < round.participants.length; i++) {
            if (round.hasSubmitted[round.participants[i]]) {
                values[count] = round.submissions[round.participants[i]];
                count++;
            }
        }

        require(count >= minNodesForConsensus, "Not enough submissions");

        // Calculate median
        int256 median = _calculateMedian(values, count);
        round.finalValue = median;
        round.finalized = true;

        // Update reputations and distribute rewards
        _processConsensusResults(requestId, median);

        emit ConsensusReached(requestId, median);
        return median;
    }

    // ============ SLASHING ============

    /**
     * @notice Slash a node for misbehavior
     */
    function slashNode(
        address operator,
        string calldata reason
    ) external onlyOwner {
        Node storage node = nodes[operator];
        require(node.operator != address(0), "Not registered");
        require(node.status != NodeStatus.Slashed, "Already slashed");

        uint256 slashAmount = (node.stakedAmount * slashPercentage) / 10000;
        node.stakedAmount -= slashAmount;
        node.reputation = node.reputation > 2000 ? node.reputation - 2000 : 0;
        node.status = NodeStatus.Slashed;

        // Transfer slashed amount to treasury
        // In production, this would go to a slashing pool for redistribution

        emit NodeSlashed(operator, slashAmount, reason);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _selectNodes() internal view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (
                nodes[nodeList[i]].status == NodeStatus.Active &&
                nodes[nodeList[i]].reputation >= 3000
            ) {
                activeCount++;
            }
        }

        address[] memory selected = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (
                nodes[nodeList[i]].status == NodeStatus.Active &&
                nodes[nodeList[i]].reputation >= 3000
            ) {
                selected[idx] = nodeList[i];
                idx++;
            }
        }

        return selected;
    }

    function _isParticipant(
        address[] storage participants,
        address node
    ) internal view returns (bool) {
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == node) return true;
        }
        return false;
    }

    function _calculateMedian(
        int256[] memory values,
        uint256 count
    ) internal pure returns (int256) {
        // Simple bubble sort for median calculation
        for (uint256 i = 0; i < count - 1; i++) {
            for (uint256 j = 0; j < count - i - 1; j++) {
                if (values[j] > values[j + 1]) {
                    (values[j], values[j + 1]) = (values[j + 1], values[j]);
                }
            }
        }

        if (count % 2 == 0) {
            return (values[count / 2 - 1] + values[count / 2]) / 2;
        } else {
            return values[count / 2];
        }
    }

    function _processConsensusResults(
        bytes32 requestId,
        int256 median
    ) internal {
        ConsensusRound storage round = consensusRounds[requestId];

        for (uint256 i = 0; i < round.participants.length; i++) {
            address nodeAddr = round.participants[i];
            Node storage node = nodes[nodeAddr];

            if (round.hasSubmitted[nodeAddr]) {
                int256 submitted = round.submissions[nodeAddr];
                int256 deviation = submitted > median
                    ? submitted - median
                    : median - submitted;

                // If within 1% of median, reward and increase reputation
                if (deviation * 100 <= median) {
                    node.jobsCompleted++;
                    node.reputation = node.reputation < 9900
                        ? node.reputation + 100
                        : 10000;

                    // Calculate reward with reputation bonus
                    uint256 reward = baseRewardPerJob +
                        (reputationBonus * node.reputation) /
                        10000;
                    emit RewardPaid(nodeAddr, reward);
                } else {
                    // Penalize for deviation
                    node.jobsFailed++;
                    node.reputation = node.reputation > 200
                        ? node.reputation - 200
                        : 0;
                }
            } else {
                // Penalize for not participating
                node.reputation = node.reputation > 500
                    ? node.reputation - 500
                    : 0;
            }
        }
    }

    // ============ VIEW FUNCTIONS ============

    function getActiveNodes() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].status == NodeStatus.Active) {
                activeCount++;
            }
        }

        address[] memory active = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].status == NodeStatus.Active) {
                active[idx] = nodeList[i];
                idx++;
            }
        }

        return active;
    }

    function getNodeCount()
        external
        view
        returns (uint256 total, uint256 active)
    {
        total = nodeList.length;
        for (uint256 i = 0; i < nodeList.length; i++) {
            if (nodes[nodeList[i]].status == NodeStatus.Active) {
                active++;
            }
        }
    }

    function getNodeInfo(
        address operator
    )
        external
        view
        returns (
            string memory name,
            string memory endpoint,
            uint256 stakedAmount,
            uint256 reputation,
            uint256 jobsCompleted,
            NodeStatus status
        )
    {
        Node storage node = nodes[operator];
        return (
            node.name,
            node.endpoint,
            node.stakedAmount,
            node.reputation,
            node.jobsCompleted,
            node.status
        );
    }

    // ============ ADMIN FUNCTIONS ============

    function setMinStakeAmount(uint256 amount) external onlyOwner {
        minStakeAmount = amount;
    }

    function setConsensusConfig(
        uint256 _minNodes,
        uint256 _timeout
    ) external onlyOwner {
        minNodesForConsensus = _minNodes;
        consensusTimeout = _timeout;
    }

    function setRewardConfig(
        uint256 _baseReward,
        uint256 _repBonus
    ) external onlyOwner {
        baseRewardPerJob = _baseReward;
        reputationBonus = _repBonus;
    }
}
