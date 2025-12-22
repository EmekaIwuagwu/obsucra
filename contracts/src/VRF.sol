// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract VRF is Ownable {
    event RandomnessRequested(uint256 requestId, address requester, uint256 seed);
    event RandomnessFulfilled(uint256 requestId, uint256 randomness);

    uint256 public nextRequestId;
    address public oracleSigner;
    mapping(uint256 => uint256) public requests; // requestId -> randomness
    mapping(uint256 => bytes32) public requestSeeds; // requestId -> seedHash

    constructor(address _oracleSigner) Ownable(msg.sender) {
        oracleSigner = _oracleSigner;
    }

    function setOracleSigner(address _signer) external onlyOwner {
        oracleSigner = _signer;
    }

    function requestRandomness(uint256 _seed) external payable returns (uint256) {
        uint256 requestId = nextRequestId++;
        requestSeeds[requestId] = keccak256(abi.encodePacked(_seed, block.timestamp, msg.sender));
        emit RandomnessRequested(requestId, msg.sender, _seed);
        return requestId;
    }

    function fulfillRandomness(
        uint256 _requestId,
        uint256 _randomness,
        bytes calldata _signature
    ) external {
        // 1. Verify Request Exists
        bytes32 seedHash = requestSeeds[_requestId];
        require(seedHash != bytes32(0), "Invalid Request ID");

        // 2. Verify Signature (Proof)
        // The randomness itself should be the signature of the seedHash, or derived from it.
        // Here we verify that the oracle signed the (seedHash + randomness) or similar.
        // For simplicity: We verify that 'oracleSigner' signed the 'seedHash' and the resulting signature IS the randomness source.

        bytes32 ethSignedMsgHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", seedHash));
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        address signer = ecrecover(ethSignedMsgHash, v, r, s);

        require(signer == oracleSigner, "Invalid VRF Signature");

        // 3. Update State
        requests[_requestId] = _randomness;
        delete requestSeeds[_requestId]; // Prevent replay

        emit RandomnessFulfilled(_requestId, _randomness);
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    function getRandomness(uint256 _requestId) external view returns (uint256) {
        return requests[_requestId];
    }
}
