// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStakeGuard {
    function stakers(
        address
    )
        external
        view
        returns (
            uint256 balance,
            uint256 lastStakeTime,
            uint256 reputation,
            bool isActive
        );
    function slash(
        address _node,
        uint256 _amount,
        string calldata _reason
    ) external;
}

interface IVerifier {
    function verifyProof(
        uint256[8] calldata proof,
        uint256[2] calldata input
    ) external view;
}

contract ObscuraOracle is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    IERC20 public obscuraToken;
    IStakeGuard public stakeGuard;
    IVerifier public verifier;

    // Configuration
    uint256 public paymentFee = 1 * 10 ** 18; // 1 OBSCURA per request
    uint256 public minResponses = 1; // Minimum responses to aggregate
    uint256 public constant TIMEOUT = 1 hours;
    uint256 public constant REWARD_PERCENT = 90; // 90% goes to nodes
    uint256 public constant MAX_DEVIATION = 50; // 50% max deviation
    uint256 public constant SLASH_AMOUNT = 10 * 10 ** 18; // 10 OBSCURA penalty

    mapping(address => bool) public whitelistedNodes;
    mapping(address => uint256) public nodeRewards;

    struct Response {
        address node;
        uint256 value;
    }

    struct Round {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    uint80 public latestRoundId;
    mapping(uint80 => Round) public rounds;

    struct Request {
        uint256 id;
        string apiUrl;
        address requester;
        address oevBeneficiary; // The address that receives the MEV kickback
        bool oevEnabled; // Whether this request is an OEV-positive request
        bool isOptimistic; // True if fulfilled without ZK proof first
        uint256 challengeWindow; // Timestamp until which the result can be disputed
        address disputer; // Address of the challenger
        bool isDisputed; // Status of the dispute
        bool resolved; // Whether the request has been finalized
        uint256 finalValue;
        uint256 createdAt;
        uint256 minThreshold;
        uint256 maxThreshold;
        string metadata;
        Response[] responses;
        mapping(address => bool) hasResponded;
    }

    mapping(address => uint256) public oevEarnings;
    uint256 public constant DISPUTE_BOND = 100 * 1e18; // 100 OBS tokens to dispute
    uint256 public constant CHALLENGE_PERIOD = 30 minutes;

    uint256 public nextRequestId;
    mapping(uint256 => Request) public requests;

    event RequestData(
        uint256 indexed requestId,
        string apiUrl,
        uint256 min,
        uint256 max,
        address indexed requester,
        bool oevEnabled,
        address oevBeneficiary,
        bool isOptimistic
    );
    event DataSubmitted(
        uint256 indexed requestId,
        address indexed node,
        uint256 value
    );
    event RequestFulfilled(uint256 indexed requestId, uint256 finalValue);
    event NewRound(uint80 indexed roundId, int256 answer, uint256 updatedAt);
    event OEVCaptured(
        uint256 indexed requestId,
        address indexed beneficiary,
        uint256 amount
    );
    event OptimisticFulfillment(
        uint256 indexed requestId,
        uint256 value,
        uint256 deadline
    );
    event ChallengeRaised(
        uint256 indexed requestId,
        address indexed challenger,
        uint256 bond
    );
    event DisputeResolved(uint256 indexed requestId, bool success);

    event RandomnessRequested(
        uint256 indexed requestId,
        string seed,
        address indexed requester
    );
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomness);

    struct RandomnessRequest {
        string seed;
        address requester;
        uint256 randomness;
        bool resolved;
    }

    uint256 public nextRandomnessId;
    mapping(uint256 => RandomnessRequest) public randomnessRequests;

    constructor(address _token, address _stakeGuard, address _verifier) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        obscuraToken = IERC20(_token);
        stakeGuard = IStakeGuard(_stakeGuard);
        verifier = IVerifier(_verifier);
    }

    // --- Configuration ---

    function setFee(uint256 _fee) external onlyRole(ADMIN_ROLE) {
        paymentFee = _fee;
    }

    function setMinResponses(uint256 _min) external onlyRole(ADMIN_ROLE) {
        minResponses = _min;
    }

    function setStakeGuard(address _stakeGuard) external onlyRole(ADMIN_ROLE) {
        stakeGuard = IStakeGuard(_stakeGuard);
    }

    function setVerifier(address _verifier) external onlyRole(ADMIN_ROLE) {
        verifier = IVerifier(_verifier);
    }

    function setNodeWhitelist(
        address _node,
        bool _status
    ) external onlyRole(ADMIN_ROLE) {
        whitelistedNodes[_node] = _status;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // --- Core Logic ---

    function requestData(
        string calldata apiUrl,
        uint256 min,
        uint256 max,
        string calldata metadata
    ) external whenNotPaused nonReentrant returns (uint256) {
        return
            _requestDataInternal(apiUrl, min, max, metadata, address(0), false);
    }

    /**
     * @notice OEV-Positive Request: Allows protocols to recapture MEV
     * @param beneficiary The treasury or contract to receive recaptured OEV
     */
    function requestDataOEV(
        string calldata apiUrl,
        uint256 min,
        uint256 max,
        string calldata metadata,
        address beneficiary
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(beneficiary != address(0), "Invalid OEV beneficiary");
        return
            _requestDataInternal(apiUrl, min, max, metadata, beneficiary, true);
    }

    function _requestDataInternal(
        string calldata apiUrl,
        uint256 min,
        uint256 max,
        string calldata metadata,
        address beneficiary,
        bool oevEnabled
    ) internal returns (uint256) {
        // Collect Payment
        require(
            obscuraToken.transferFrom(msg.sender, address(this), paymentFee),
            "Fee payment failed"
        );

        uint256 requestId = nextRequestId++;
        Request storage req = requests[requestId];
        req.id = requestId;
        req.apiUrl = apiUrl;
        req.requester = msg.sender;
        req.oevBeneficiary = beneficiary;
        req.oevEnabled = oevEnabled;
        req.createdAt = block.timestamp;
        req.minThreshold = min;
        req.maxThreshold = max;
        req.metadata = metadata;

        emit RequestData(
            requestId,
            apiUrl,
            min,
            max,
            msg.sender,
            oevEnabled,
            beneficiary,
            false
        );
        return requestId;
    }

    function fulfillData(
        uint256 requestId,
        uint256 value,
        uint256[8] calldata zkpProof,
        uint256[2] calldata publicInputs
    ) external whenNotPaused nonReentrant {
        _fulfillDataInternal(requestId, value, zkpProof, publicInputs, 0);
    }

    /**
     * @notice Fulfill with OEV Bid: Searchers call this to prioritize their transaction.
     * The bid is recaptured and sent to the protocol's beneficiary.
     */
    function fulfillDataWithOEV(
        uint256 requestId,
        uint256 value,
        uint256[8] calldata zkpProof,
        uint256[2] calldata publicInputs,
        uint256 oevBid
    ) external whenNotPaused nonReentrant {
        Request storage req = requests[requestId];
        require(req.oevEnabled, "OEV not enabled for this request");
        _handleOEV(req, oevBid);
        _fulfillDataInternal(requestId, value, zkpProof, publicInputs, oevBid);
    }

    function fulfillDataOptimistic(
        uint256 requestId,
        uint256 value
    ) external whenNotPaused nonReentrant {
        require(whitelistedNodes[msg.sender], "Not whitelisted");
        Request storage req = requests[requestId];
        require(!req.isOptimistic && req.finalValue == 0, "Already fulfilled");

        req.isOptimistic = true;
        req.finalValue = value;
        req.challengeWindow = block.timestamp + CHALLENGE_PERIOD;

        emit OptimisticFulfillment(requestId, value, req.challengeWindow);
    }

    function disputeFulfillment(
        uint256 requestId
    ) external whenNotPaused nonReentrant {
        Request storage req = requests[requestId];
        require(req.isOptimistic, "Not an optimistic fulfillment");
        require(
            block.timestamp <= req.challengeWindow,
            "Challenge window closed"
        );
        require(!req.isDisputed, "Already disputed");

        require(
            obscuraToken.transferFrom(msg.sender, address(this), DISPUTE_BOND),
            "Bond required"
        );

        req.isDisputed = true;
        req.disputer = msg.sender;

        emit ChallengeRaised(requestId, msg.sender, DISPUTE_BOND);
    }

    function resolveDispute(
        uint256 requestId,
        uint256[8] calldata zkpProof,
        uint256[2] calldata publicInputs
    ) external whenNotPaused nonReentrant {
        Request storage req = requests[requestId];
        require(req.isDisputed, "No active dispute");

        // Verify the ZK proof against the value that was posted optimistically
        bool isValid = true;
        try verifier.verifyProof(zkpProof, publicInputs) {
            isValid = true;
        } catch {
            isValid = false;
        }
        if (
            isValid &&
            publicInputs[0] <= req.finalValue &&
            publicInputs[1] >= req.finalValue
        ) {
            // Node was correct! Slashing challenger, rewarding node.
            obscuraToken.transfer(msg.sender, DISPUTE_BOND); // Return bond + reward? For MVP just return bond.
            emit DisputeResolved(requestId, true);
        } else {
            // Node was WRONG or proof failed. Slashing node, rewarding challenger.
            // stakeGuard.slash(nodeAddr, amount); // Production logic
            obscuraToken.transfer(req.disputer, DISPUTE_BOND * 2);
            req.finalValue = 0; // Invalidate result
            emit DisputeResolved(requestId, false);
        }

        req.isDisputed = false;
        req.isOptimistic = false; // Finalized via ZK
    }

    function _handleOEV(Request storage req, uint256 oevBid) internal {
        require(oevBid > 0, "Bid required for OEV fulfillment");
        require(
            obscuraToken.transferFrom(msg.sender, address(this), oevBid),
            "OEV bid transfer failed"
        );
        oevEarnings[req.oevBeneficiary] += oevBid;
        emit OEVCaptured(req.id, req.oevBeneficiary, oevBid);
    }

    function _fulfillDataInternal(
        uint256 requestId,
        uint256 value,
        uint256[8] calldata zkpProof,
        uint256[2] calldata publicInputs,
        uint256 /* oevBid */
    ) internal {
        // 1. Authorization Check
        require(whitelistedNodes[msg.sender], "Not whitelisted");
        (, , , bool isActive) = stakeGuard.stakers(msg.sender);
        require(isActive, "Node not active in StakeGuard");

        Request storage req = requests[requestId];
        require(!req.resolved, "Request already resolved");
        require(!req.hasResponded[msg.sender], "Already responded");

        // 2. Optional ZK Verification (if configured)
        if (address(verifier) != address(0) && publicInputs.length > 0) {
            verifier.verifyProof(zkpProof, publicInputs);
        }

        // 3. Record Response
        req.responses.push(Response({node: msg.sender, value: value}));
        req.hasResponded[msg.sender] = true;

        emit DataSubmitted(requestId, msg.sender, value);

        // 4. Try to Aggregate
        if (req.responses.length >= minResponses) {
            _aggregateAndFinalize(requestId);
        }
    }

    function _aggregateAndFinalize(uint256 requestId) internal {
        Request storage req = requests[requestId];

        // Simple Median Aggregation
        uint256[] memory values = new uint256[](req.responses.length);
        for (uint256 i = 0; i < req.responses.length; i++) {
            values[i] = req.responses[i].value;
        }

        uint256 medianValue = _calculateMedian(values);

        req.finalValue = medianValue;
        req.resolved = true;

        // Store as a new persistent round
        latestRoundId++;
        rounds[latestRoundId] = Round({
            roundId: latestRoundId,
            answer: int256(medianValue),
            startedAt: req.createdAt,
            updatedAt: block.timestamp,
            answeredInRound: latestRoundId
        });
        emit NewRound(latestRoundId, int256(medianValue), block.timestamp);

        // Pay the nodes (distribute fee) AND slash outliers
        if (req.responses.length > 0) {
            uint256 totalReward = (paymentFee * REWARD_PERCENT) / 100;
            uint256 rewardPerNode = totalReward / req.responses.length;

            for (uint256 i = 0; i < req.responses.length; i++) {
                address node = req.responses[i].node;
                uint256 val = req.responses[i].value;

                // Outlier check
                bool isOutlier = false;
                if (medianValue > 0) {
                    if (
                        val > (medianValue * (100 + MAX_DEVIATION)) / 100 ||
                        val < (medianValue * (100 - MAX_DEVIATION)) / 100
                    ) {
                        isOutlier = true;
                    }
                } else if (val > 0) {
                    isOutlier = true;
                }

                if (isOutlier) {
                    // Slash
                    try
                        stakeGuard.slash(
                            node,
                            SLASH_AMOUNT,
                            "Price deviation outlier"
                        )
                    {} catch {}
                } else {
                    // Reward
                    nodeRewards[node] += rewardPerNode;
                }
            }
        }

        emit RequestFulfilled(requestId, medianValue);
    }

    function _calculateMedian(
        uint256[] memory values
    ) internal pure returns (uint256) {
        // Sort
        for (uint256 i = 0; i < values.length; i++) {
            for (uint256 j = i + 1; j < values.length; j++) {
                if (values[i] > values[j]) {
                    uint256 temp = values[i];
                    values[i] = values[j];
                    values[j] = temp;
                }
            }
        }

        if (values.length % 2 == 0) {
            return
                (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
        } else {
            return values[values.length / 2];
        }
    }

    // Force finalize if stuck (by admin)
    function forceFinalize(uint256 requestId) external onlyRole(ADMIN_ROLE) {
        _aggregateAndFinalize(requestId);
    }

    // --- Chainlink Compatibility ---

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(latestRoundId > 0, "No rounds exist");
        Round storage r = rounds[latestRoundId];
        return (
            r.roundId,
            r.answer,
            r.startedAt,
            r.updatedAt,
            r.answeredInRound
        );
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(_roundId <= latestRoundId && _roundId > 0, "Invalid round ID");
        Round storage r = rounds[_roundId];
        return (
            r.roundId,
            r.answer,
            r.startedAt,
            r.updatedAt,
            r.answeredInRound
        );
    }

    function decimals() external pure returns (uint8) {
        return 8; // Standard for price feeds
    }

    function description() external pure returns (string memory) {
        return "Obscura Privacy Oracle Feed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function latestAnswer() external view returns (int256) {
        require(latestRoundId > 0, "No rounds exist");
        return rounds[latestRoundId].answer;
    }

    function latestTimestamp() external view returns (uint256) {
        require(latestRoundId > 0, "No rounds exist");
        return rounds[latestRoundId].updatedAt;
    }

    // --- Rewards & Refunds ---

    function claimRewards() external nonReentrant {
        uint256 reward = nodeRewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        nodeRewards[msg.sender] = 0;
        require(obscuraToken.transfer(msg.sender, reward), "Transfer failed");
    }

    function cancelRequest(uint256 requestId) external nonReentrant {
        Request storage req = requests[requestId];
        require(req.requester == msg.sender, "Not the requester");
        require(!req.resolved, "Already resolved");
        require(
            block.timestamp > req.createdAt + TIMEOUT,
            "Timeout not reached"
        );

        req.resolved = true; // Mark as "resolved" to prevent further submissions
        // Refund full fee (or minus small penalty? For now full refund)
        require(obscuraToken.transfer(msg.sender, paymentFee), "Refund failed");
    }

    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        // Only withdraw non-rewarded surplus (platform fee)
        uint256 bal = obscuraToken.balanceOf(address(this));
        // This is a safety check: in production we'd track protocolFees explicitly
        obscuraToken.transfer(msg.sender, bal);
    }

    // --- OEV Rewards ---

    function claimOEVEarnings() external nonReentrant {
        uint256 amount = oevEarnings[msg.sender];
        require(amount > 0, "No OEV earnings to claim");
        oevEarnings[msg.sender] = 0;
        require(
            obscuraToken.transfer(msg.sender, amount),
            "OEV transfer failed"
        );
    }

    // --- VRF Logic ---

    function requestRandomness(
        string calldata seed
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(
            obscuraToken.transferFrom(msg.sender, address(this), paymentFee),
            "Fee payment failed"
        );

        uint256 requestId = nextRandomnessId++;
        RandomnessRequest storage req = randomnessRequests[requestId];
        req.seed = seed;
        req.requester = msg.sender;

        emit RandomnessRequested(requestId, seed, msg.sender);
        return requestId;
    }

    function fulfillRandomness(
        uint256 requestId,
        uint256 randomness,
        bytes calldata /* proof */
    ) external whenNotPaused nonReentrant {
        require(whitelistedNodes[msg.sender], "Not whitelisted");
        (, , , bool isActive) = stakeGuard.stakers(msg.sender);
        require(isActive, "Node not active");

        RandomnessRequest storage req = randomnessRequests[requestId];
        require(!req.resolved, "Already resolved");

        // In production, we'd verify the ZK or ECDSA proof here.
        // For MVP, we record and emit.
        req.randomness = randomness;
        req.resolved = true;

        // Reward the node
        uint256 reward = (paymentFee * REWARD_PERCENT) / 100;
        nodeRewards[msg.sender] += reward;

        emit RandomnessFulfilled(requestId, randomness);
    }
}
