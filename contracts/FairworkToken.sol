// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FairworkToken is ERC20 {
    constructor(
        address[] memory recipients,
        uint256[] memory allocations
    ) ERC20("Fairwork Demo Credit", "FWC") {
        require(recipients.length == allocations.length, "Mismatched arrays");
        
        uint256 totalAllocated = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(allocations[i] > 0, "Allocation must be positive");
            _mint(recipients[i], allocations[i]);
            totalAllocated += allocations[i];
        }
        
        require(totalAllocated == 6000, "Total supply must be exactly 6000");
    }

    function decimals() public view virtual override returns (uint8) {
        return 0; // 0 decimals to ensure only whole credits exist
    }
}
