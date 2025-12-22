// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStakeGuard {
    function stakers(address) external view returns (uint256 balance, uint256 lastStakeTime, uint256 reputation, bool isActive);
}

interface IVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[2] calldata input) external view;
}

contract ObscuraOracle is Ownable {
    IStakeGuard public stakeGuard;
    IVerifier public verifier;
    mapping(address => bool) public whitelistedNodes;

    struct Request {
        uint256 id;
        string apiUrl;
        address requester;
        uint256 value;
        bool resolved;
        uint256[8] zkpProof; 
        uint256[2] publicInputs;
        uint256 minThreshold;
        uint256 maxThreshold;
        string metadata; // For custom integration params
    }

    uint256 public nextRequestId;
    mapping(uint256 => Request) public requests;

    event RequestData(uint256 indexed requestId, string apiUrl, uint256 min, uint256 max, address indexed requester);
    event DataFulfilled(uint256 indexed requestId, uint256 value, uint256[8] zkpProof);

    constructor(address _stakeGuard, address _verifier) Ownable(msg.sender) {
        stakeGuard = IStakeGuard(_stakeGuard);
        verifier = IVerifier(_verifier);
    }

    modifier onlyAuthorizedNode() {
        require(whitelistedNodes[msg.sender], "Not whitelisted");
        (,,, bool isActive) = stakeGuard.stakers(msg.sender);
        require(isActive, "Node not active in StakeGuard");
        _;
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

    function requestData(
        string calldata apiUrl, 
        uint256 min, 
        uint256 max, 
        string calldata metadata
    ) external returns (uint256) {
        uint256 requestId = nextRequestId++;
        Request storage req = requests[requestId];
        req.id = requestId;
        req.apiUrl = apiUrl;
        req.requester = msg.sender;
        req.resolved = false;
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
    ) external onlyAuthorizedNode {
        Request storage req = requests[requestId];
        require(!req.resolved, "Already resolved");
        
        // Cryptographic verification
        if (address(verifier) != address(0)) {
            verifier.verifyProof(zkpProof, publicInputs);
        }

        req.value = value;
        req.zkpProof = zkpProof;
        req.publicInputs = publicInputs;
        req.resolved = true;

        emit DataFulfilled(requestId, value, zkpProof);
    }
}
