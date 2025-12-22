// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract VRF is Ownable {
    event RandomnessRequested(uint256 requestId, address requester, uint256 seed);
    event RandomnessFulfilled(uint256 requestId, uint256 randomness);

    uint256 public nextRequestId;
    mapping(uint256 => uint256) public requests; // requestId -> randomness

    constructor() Ownable(msg.sender) {}

    function requestRandomness(uint256 _seed) external payable returns (uint256) {
        uint256 requestId = nextRequestId++;
        emit RandomnessRequested(requestId, msg.sender, _seed);
        return requestId;
    }

    function fulfillRandomness(uint256 _requestId, uint256 _randomness) external onlyOwner {
        requests[_requestId] = _randomness;
        emit RandomnessFulfilled(_requestId, _randomness);
    }

    function getRandomness(uint256 _requestId) external view returns (uint256) {
        return requests[_requestId];
    }
}
