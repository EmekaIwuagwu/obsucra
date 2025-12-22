// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ObscuraToken is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("Obscura Token", "OBS") Ownable(msg.sender) {
        _mint(msg.sender, 100_000_000 * 10 ** decimals()); // 100M initial supply
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
