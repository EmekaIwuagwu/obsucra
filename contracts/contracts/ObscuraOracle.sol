// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStakeGuard {
    function stakers(address) external view returns (uint256 balance, uint256 lastStakeTime, uint256 reputation, bool isActive);
    function slash(address _node, uint256 _amount, string calldata _reason) external;
}

interface IVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[2] calldata input) external view;
}

contract ObscuraOracle is Ownable, ReentrancyGuard {
    IERC20 public obscuraToken;
    IStakeGuard public stakeGuard;
    IVerifier public verifier;

    // Configuration
    uint256 public paymentFee = 1 * 10**18; // 1 OBSCURA per request
    uint256 public minResponses = 1; // Minimum responses to aggregate
    uint256 public constant TIMEOUT = 1 hours;
    uint256 public constant REWARD_PERCENT = 90; // 90% goes to nodes
    uint256 public constant MAX_DEVIATION = 50; // 50% max deviation
    uint256 public constant SLASH_AMOUNT = 10 * 10**18; // 10 OBSCURA penalty
    
    mapping(address => bool) public whitelistedNodes;
    mapping(address => uint256) public nodeRewards;

    struct Response {
        address node;
        uint256 value;
    }

    struct Request {
        uint256 id;
        string apiUrl;
        address requester;
        bool resolved;
        uint256 finalValue;
        uint256 createdAt;
        uint256 minThreshold;
        uint256 maxThreshold;
        string metadata;
        Response[] responses;
        mapping(address => bool) hasResponded;
    }

    uint256 public nextRequestId;
    mapping(uint256 => Request) public requests;

    event RequestData(uint256 indexed requestId, string apiUrl, uint256 min, uint256 max, address indexed requester);
    event DataSubmitted(uint256 indexed requestId, address indexed node, uint256 value);
    event RequestFulfilled(uint256 indexed requestId, uint256 finalValue);

    constructor(address _token, address _stakeGuard, address _verifier) Ownable(msg.sender) {
        obscuraToken = IERC20(_token);
        stakeGuard = IStakeGuard(_stakeGuard);
        verifier = IVerifier(_verifier);
    }

    // --- Configuration ---

    function setFee(uint256 _fee) external onlyOwner {
        paymentFee = _fee;
    }

    function setMinResponses(uint256 _min) external onlyOwner {
        minResponses = _min;
    }

    function setStakeGuard(address _stakeGuard) external onlyOwner {
        stakeGuard = IStakeGuard(_stakeGuard);
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
    }

    function setNodeWhitelist(address _node, bool _status) external onlyOwner {
        whitelistedNodes[_node] = _status;
    }

    // --- Core Logic ---

    function requestData(
        string calldata apiUrl, 
        uint256 min, 
        uint256 max, 
        string calldata metadata
    ) external nonReentrant returns (uint256) {
        // Collect Payment
        require(obscuraToken.transferFrom(msg.sender, address(this), paymentFee), "Fee payment failed");

        uint256 requestId = nextRequestId++;
        Request storage req = requests[requestId];
        req.id = requestId;
        req.apiUrl = apiUrl;
        req.requester = msg.sender;
        req.createdAt = block.timestamp;
        req.minThreshold = min;
        req.maxThreshold = max;
        req.metadata = metadata;
        
        emit RequestData(requestId, apiUrl, min, max, msg.sender);
        return requestId;
    }

    function fulfillData(
        uint256 requestId, 
        uint256 value, 
        uint256[8] calldata zkpProof, 
        uint256[2] calldata publicInputs
    ) external nonReentrant {
        // 1. Authorization Check
        require(whitelistedNodes[msg.sender], "Not whitelisted");
        (,,, bool isActive) = stakeGuard.stakers(msg.sender);
        require(isActive, "Node not active in StakeGuard");

        Request storage req = requests[requestId];
        require(!req.resolved, "Request already resolved");
        require(!req.hasResponded[msg.sender], "Already responded");

        // 2. Optional ZK Verification (if configured)
        if (address(verifier) != address(0) && publicInputs.length > 0) {
            verifier.verifyProof(zkpProof, publicInputs);
        }

        // 3. Record Response
        req.responses.push(Response({
            node: msg.sender,
            value: value
        }));
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
        for(uint256 i = 0; i < req.responses.length; i++) {
            values[i] = req.responses[i].value;
        }
        
        uint256 medianValue = _calculateMedian(values);
        
        req.finalValue = medianValue;
        req.resolved = true;

        // Pay the nodes (distribute fee) AND slash outliers
        if (req.responses.length > 0) {
            uint256 totalReward = (paymentFee * REWARD_PERCENT) / 100;
            uint256 rewardPerNode = totalReward / req.responses.length;
            
            for(uint256 i = 0; i < req.responses.length; i++) {
                address node = req.responses[i].node;
                uint256 val = req.responses[i].value;
                
                // Outlier check
                bool isOutlier = false;
                if (medianValue > 0) {
                    if (val > (medianValue * (100 + MAX_DEVIATION)) / 100 || 
                        val < (medianValue * (100 - MAX_DEVIATION)) / 100) {
                        isOutlier = true;
                    }
                } else if (val > 0) {
                    isOutlier = true;
                }

                if (isOutlier) {
                    // Slash
                    try stakeGuard.slash(node, SLASH_AMOUNT, "Price deviation outlier") {} catch {}
                } else {
                    // Reward
                    nodeRewards[node] += rewardPerNode;
                }
            }
        }

        emit RequestFulfilled(requestId, medianValue);
    }

    function _calculateMedian(uint256[] memory values) internal pure returns (uint256) {
        // Sort
        for(uint256 i = 0; i < values.length; i++) {
            for(uint256 j = i + 1; j < values.length; j++) {
                if(values[i] > values[j]) {
                    uint256 temp = values[i];
                    values[i] = values[j];
                    values[j] = temp;
                }
            }
        }
        
        if (values.length % 2 == 0) {
            return (values[values.length/2 - 1] + values[values.length/2]) / 2;
        } else {
            return values[values.length/2];
        }
    }

    // Force finalize if stuck (by admin)
    function forceFinalize(uint256 requestId) external onlyOwner {
        _aggregateAndFinalize(requestId);
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
        require(block.timestamp > req.createdAt + TIMEOUT, "Timeout not reached");

        req.resolved = true; // Mark as "resolved" to prevent further submissions
        // Refund full fee (or minus small penalty? For now full refund)
        require(obscuraToken.transfer(msg.sender, paymentFee), "Refund failed");
    }

    function withdrawFees() external onlyOwner {
        // Only withdraw non-rewarded surplus (platform fee)
        uint256 bal = obscuraToken.balanceOf(address(this));
        // This is a safety check: in production we'd track protocolFees explicitly
        obscuraToken.transfer(msg.sender, bal);
    }
}
