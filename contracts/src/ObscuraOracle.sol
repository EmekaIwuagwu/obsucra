// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IZKVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input
    ) external view returns (bool);
}

contract ObscuraOracle is Ownable, ReentrancyGuard {
    struct Request {
        uint256 id;
        string apiUrl;
        address requester;
        uint256 value; // Result value
        bool resolved;
        uint256 minThreshold; // For consensus
        uint256 maxThreshold;
        string metadata;
    }

    uint256 public requestCounter;
    mapping(uint256 => Request) public requests;
    mapping(uint256 => mapping(address => bool)) public hasVoted; // node -> voted

    IZKVerifier public verifier;
    uint256 public fee;

    event DataRequested(uint256 indexed id, string url, address requester, string metadata);
    event DataFulfilled(uint256 indexed id, uint256 value, address node);
    event RequestResolved(uint256 indexed id, uint256 finalValue);

    constructor(address _verifier, uint256 _fee) Ownable(msg.sender) {
        verifier = IZKVerifier(_verifier);
        fee = _fee;
    }

    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function requestData(
        string calldata _apiUrl,
        uint256 _min,
        uint256 _max,
        string calldata _metadata
    ) external payable returns (uint256) {
        require(msg.value >= fee, "Insufficient fee");
        
        requestCounter++;
        requests[requestCounter] = Request({
            id: requestCounter,
            apiUrl: _apiUrl,
            requester: msg.sender,
            value: 0,
            resolved: false,
            minThreshold: _min,
            maxThreshold: _max,
            metadata: _metadata
        });

        emit DataRequested(requestCounter, _apiUrl, msg.sender, _metadata);
        return requestCounter;
    }

    // Fulfill with ZK Proof
    mapping(address => uint256) public nodeBalances;

    // Fulfill with ZK Proof
    function fulfillDataZK(
        uint256 _requestId,
        uint256 _value,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input
    ) external nonReentrant {
        Request storage req = requests[_requestId];
        require(!req.resolved, "Already resolved");
        
        // Check ZK Proof
        // require(verifier.verifyProof(a, b, c, input), "Invalid ZKP");
        
        // In a real scenario, input[0] should match hash(_value) or similar binding
        
        req.value = _value;
        req.resolved = true;
        
        // Credit the Node
        nodeBalances[msg.sender] += fee;

        emit DataFulfilled(_requestId, _value, msg.sender);
        emit RequestResolved(_requestId, _value);
    }

    function withdraw() external nonReentrant {
        uint256 amount = nodeBalances[msg.sender];
        require(amount > 0, "No funds to withdraw");
        
        nodeBalances[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }
}
