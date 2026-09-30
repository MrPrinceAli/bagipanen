// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICampaignFactory} from "./interfaces/IBagiPanen.sol";

/// @notice Rapor Petani (riwayat kredit alternatif) dan statistik agen verifikator.
/// Hanya bisa ditulis oleh kampanye resmi dari factory.
contract ReputationBook {
    struct FarmerStats {
        uint32 campaignsFunded;
        uint32 harvestsCompleted;
        uint32 onTimeHarvests;
        uint32 cropFailures;
        uint32 defaults;
        uint256 totalReported;
        uint256 totalEstimated;
    }

    struct AgentStats {
        uint32 verdicts;
        uint32 approvals;
        uint32 rejections;
        uint32 overturned;
    }

    ICampaignFactory public immutable factory;
    mapping(address => FarmerStats) private _farmers;
    AgentStats private _agent;

    error ZeroAddress();
    error NotCampaign();

    modifier onlyCampaign() {
        if (!factory.isCampaign(msg.sender)) revert NotCampaign();
        _;
    }

    constructor(ICampaignFactory factory_) {
        if (address(factory_) == address(0)) revert ZeroAddress();
        factory = factory_;
    }

    function recordFunded(address farmer) external onlyCampaign {
        _farmers[farmer].campaignsFunded += 1;
    }

    function recordHarvest(address farmer, uint256 reported, uint256 estimated, bool onTime) external onlyCampaign {
        FarmerStats storage s = _farmers[farmer];
        s.harvestsCompleted += 1;
        if (onTime) s.onTimeHarvests += 1;
        s.totalReported += reported;
        s.totalEstimated += estimated;
    }

    function recordCropFailure(address farmer) external onlyCampaign {
        _farmers[farmer].cropFailures += 1;
    }

    function recordDefault(address farmer) external onlyCampaign {
        _farmers[farmer].defaults += 1;
    }

    function recordVerdict(bool approved) external onlyCampaign {
        _agent.verdicts += 1;
        if (approved) _agent.approvals += 1;
        else _agent.rejections += 1;
    }

    /// @notice Dicatat saat admin (resolveDispute) memutuskan berlawanan dengan putusan AI.
    function recordOverturn() external onlyCampaign {
        _agent.overturned += 1;
    }

    function getFarmerStats(address farmer) external view returns (FarmerStats memory) {
        return _farmers[farmer];
    }

    function getAgentStats() external view returns (AgentStats memory) {
        return _agent;
    }

    /// @notice Petani yang pernah gagal bayar diblokir membuat kampanye baru.
    function isBlocked(address farmer) external view returns (bool) {
        return _farmers[farmer].defaults > 0;
    }
}
