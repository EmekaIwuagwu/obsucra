// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract InstData is Ownable {
    // Whitelist for institutional data providers
    mapping(address => bool) public authorizedProviders;

    event DataPosted(string indexed asset, uint256 price, uint256 timestamp, address provider);

    constructor() Ownable(msg.sender) {}

    function addProvider(address _provider) external onlyOwner {
        authorizedProviders[_provider] = true;
    }

    function removeProvider(address _provider) external onlyOwner {
        authorizedProviders[_provider] = false;
    }

    function postData(string calldata _asset, uint256 _price) external {
        require(authorizedProviders[msg.sender], "Unauthorized");
        emit DataPosted(_asset, _price, block.timestamp, msg.sender);
    }
}
