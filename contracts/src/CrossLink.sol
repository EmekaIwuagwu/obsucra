// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CrossLink is Ownable {
    event MessageSent(bytes32 indexed msgId, string targetChain, address targetAddress, bytes payload);
    event MessageReceived(bytes32 indexed msgId, string sourceChain, address sourceAddress, bytes payload);

    mapping(bytes32 => bool) public processedMessages;

    constructor() Ownable(msg.sender) {}

    function sendMessage(string calldata _targetChain, address _targetAddress, bytes calldata _payload) external payable {
        bytes32 msgId = keccak256(abi.encodePacked(block.timestamp, msg.sender, _targetChain, _payload));
        emit MessageSent(msgId, _targetChain, _targetAddress, _payload);
    }

    // Called by off-chain bridge nodes after verifying validity proof
    function receiveMessage(
        bytes32 _msgId, 
        string calldata _sourceChain, 
        address _sourceAddress, 
        bytes calldata _payload
    ) external onlyOwner {
        require(!processedMessages[_msgId], "Already processed");
        processedMessages[_msgId] = true;
        
        emit MessageReceived(_msgId, _sourceChain, _sourceAddress, _payload);
        
        // Execute call if payload implies it
    }
}
