// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Stablecoin tiruan untuk demo (18 desimal). `mint` terbuka untuk siapa saja.
contract MockUSDT is ERC20 {
    uint256 public constant MAX_MINT = 10_000e18;

    error MintTooLarge();

    constructor() ERC20("Mock USDT", "mUSDT") {}

    function mint(address to, uint256 amount) external {
        if (amount > MAX_MINT) revert MintTooLarge();
        _mint(to, amount);
    }
}
