// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CrossLink is Ownable {
    event MessageSent(bytes32 indexed msgId, string targetChain, address targetAddress, bytes payload);
    event MessageReceived(bytes32 indexed msgId, string sourceChain, address sourceAddress, bytes payload);

    mapping(bytes32 => bool) public processedMessages;

    mapping(address => bool) public approvedRelayers;
    uint256 public constant MIN_SIGNATURES = 1; // For prototype

    constructor() Ownable(msg.sender) {
        approvedRelayers[msg.sender] = true;
    }

    function addRelayer(address _relayer) external onlyOwner {
        approvedRelayers[_relayer] = true;
    }

    function removeRelayer(address _relayer) external onlyOwner {
        approvedRelayers[_relayer] = false;
    }

    // Called by off-chain bridge nodes after verifying validity proof
    function receiveMessage(
        bytes32 _msgId, 
        string calldata _sourceChain, 
        address _sourceAddress, 
        bytes calldata _payload,
        bytes calldata _signature // Added signature
    ) external {
        // Verify Relayer
        if (!approvedRelayers[msg.sender]) {
             // If sender is not approved, check if they carry a signature from an approved relayer
             bytes32 hash = keccak256(abi.encodePacked(_msgId, _sourceChain, _sourceAddress, _payload));
             bytes32 ethSignedMsgHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
             (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
             address signer = ecrecover(ethSignedMsgHash, v, r, s);
             require(approvedRelayers[signer], "Invalid Relayer Signature");
        }

        require(!processedMessages[_msgId], "Already processed");
        processedMessages[_msgId] = true;
        
        emit MessageReceived(_msgId, _sourceChain, _sourceAddress, _payload);
        
        // Execute call if payload implies it
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
}
