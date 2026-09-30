// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {HarvestCampaign, CampaignParams} from "./HarvestCampaign.sol";

/// @notice Pembantu CampaignFactory yang memuat bytecode HarvestCampaign.
/// Dipisah agar runtime CampaignFactory tetap di bawah batas ukuran kontrak
/// (EIP-170, 24.576 byte). Dibuat otomatis di constructor factory dan hanya
/// bisa dipanggil oleh factory tersebut.
contract CampaignDeployer {
    address public immutable factory;

    error NotFactory();

    constructor() {
        factory = msg.sender;
    }

    function deploy(uint256 campaignId, address farmer, address cooperative, CampaignParams calldata p)
        external
        returns (address)
    {
        if (msg.sender != factory) revert NotFactory();
        return address(new HarvestCampaign(factory, campaignId, farmer, cooperative, p));
    }
}
