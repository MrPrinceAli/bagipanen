// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Antarmuka internal antarkontrak BagiPanen (menghindari import melingkar).

interface ICampaignFactory {
    function owner() external view returns (address);
    function usdt() external view returns (address);
    function reputationBook() external view returns (address);
    function reservePool() external view returns (address);
    function isCampaign(address campaign) external view returns (bool);
    function isAgent(address account) external view returns (bool);
}

interface IReputationBook {
    function recordFunded(address farmer) external;
    function recordHarvest(address farmer, uint256 reported, uint256 estimated, bool onTime) external;
    function recordCropFailure(address farmer) external;
    function recordDefault(address farmer) external;
    function recordVerdict(bool approved) external;
    function recordOverturn() external;
    function isBlocked(address farmer) external view returns (bool);
}

interface IReservePool {
    function contribute(uint256 amount) external;
}

interface IHarvestCampaign {
    function addCompensation(uint256 amount) external;
}
