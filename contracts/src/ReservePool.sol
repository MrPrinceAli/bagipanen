// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICampaignFactory, IHarvestCampaign} from "./interfaces/IBagiPanen.sol";

/// @notice Dana cadangan (5% keuntungan tiap panen). Admin hanya bisa menyalurkan
/// dana ke kampanye resmi sebagai kompensasi, tidak ke alamat lain.
contract ReservePool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ICampaignFactory public immutable factory;
    IERC20 public immutable usdt;
    uint256 public totalContributed;
    uint256 public totalCompensated;

    event Contributed(address indexed campaign, uint256 amount);
    event Compensated(address indexed campaign, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error NotCampaign();

    constructor(ICampaignFactory factory_, IERC20 usdt_) Ownable(msg.sender) {
        if (address(factory_) == address(0) || address(usdt_) == address(0)) revert ZeroAddress();
        factory = factory_;
        usdt = usdt_;
    }

    /// @notice Dicatat oleh kampanye setelah mentransfer bagian cadangan ke sini.
    function contribute(uint256 amount) external {
        if (!factory.isCampaign(msg.sender)) revert NotCampaign();
        totalContributed += amount;
        emit Contributed(msg.sender, amount);
    }

    /// @notice Salurkan kompensasi ke kampanye yang gagal panen / gagal bayar.
    function compensate(address campaign, uint256 amount) external onlyOwner nonReentrant {
        if (!factory.isCampaign(campaign)) revert NotCampaign();
        if (amount == 0) revert ZeroAmount();
        totalCompensated += amount;
        usdt.safeTransfer(campaign, amount);
        IHarvestCampaign(campaign).addCompensation(amount);
        emit Compensated(campaign, amount);
    }

    function balance() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }
}
