// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./BaseTest.sol";
import {HarvestCampaign} from "../src/HarvestCampaign.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {ReputationBook} from "../src/ReputationBook.sol";

/// @notice Skenario wajib dari PRD (Testing & acceptance criteria).
contract ScenariosTest is BaseTest {
    /// Happy path lengkap dengan angka contoh perhitungan PRD.
    function test_HappyPath_FullCampaign() public {
        HarvestCampaign c = _create();
        _assertStatus(c, HarvestCampaign.Status.Draft);

        vm.prank(admin);
        factory.approveCampaign(address(c));
        _assertStatus(c, HarvestCampaign.Status.Funding);
        assertEq(c.fundingDeadline(), block.timestamp + FUNDING_DURATION);

        _fundAll(c);
        _assertStatus(c, HarvestCampaign.Status.Active);
        assertEq(c.raisedAmount(), 1_000e18);
        assertEq(c.balanceOf(rina), 500e18);
        assertEq(c.balanceOf(budi), 300e18);
        assertEq(c.balanceOf(sari), 200e18);
        assertEq(rep.getFarmerStats(farmer).campaignsFunded, 1);

        // 3 milestone cair: 400 / 350 / 250
        uint256 f0 = usdt.balanceOf(farmer);
        _release(c);
        assertEq(usdt.balanceOf(farmer) - f0, 400e18, "cair Tanam");
        _release(c);
        assertEq(usdt.balanceOf(farmer) - f0, 750e18, "cair Tumbuh");
        _release(c);
        assertEq(usdt.balanceOf(farmer) - f0, 1_000e18, "cair Pra-panen");
        assertEq(c.totalReleased(), 1_000e18);
        assertEq(usdt.balanceOf(address(c)), 0);
        for (uint256 i; i < 3; ++i) {
            _assertMStatus(c, i, HarvestCampaign.MStatus.Released);
        }

        // Setor hasil penjualan 1.650
        _mintTo(farmer, 650e18); // simulasi hasil penjualan panen
        uint256 fBefore = usdt.balanceOf(farmer);
        _deposit(c, 1_650e18);
        _assertStatus(c, HarvestCampaign.Status.Harvested);
        assertEq(fBefore - usdt.balanceOf(farmer), 1_650e18 - 357.5e18, "bagian petani 357,5");
        assertEq(usdt.balanceOf(address(reserve)), 32.5e18, "dana cadangan 32,5");
        assertEq(reserve.totalContributed(), 32.5e18);
        assertEq(c.investorPool(), 1_260e18, "pool investor 1.260");
        assertEq(c.harvestAmount(), 1_650e18);
        assertEq(c.receiptCID(), "bafy-nota");

        // Klaim investor 630 / 378 / 252
        assertEq(c.claimable(rina), 630e18);
        assertEq(_claim(c, rina), 630e18);
        assertEq(_claim(c, budi), 378e18);
        assertEq(_claim(c, sari), 252e18);
        assertEq(usdt.balanceOf(address(c)), 0);

        // Rapor Petani & statistik agen
        ReputationBook.FarmerStats memory fs = rep.getFarmerStats(farmer);
        assertEq(fs.campaignsFunded, 1);
        assertEq(fs.harvestsCompleted, 1);
        assertEq(fs.onTimeHarvests, 1);
        assertEq(fs.totalReported, 1_650e18);
        assertEq(fs.totalEstimated, 1_650e18);
        ReputationBook.AgentStats memory ag = rep.getAgentStats();
        assertEq(ag.verdicts, 3);
        assertEq(ag.approvals, 3);

        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.NothingToClaim.selector);
        c.claim();
    }

    /// Pendanaan gagal → finalizeFunding → refund 1:1.
    function test_FundingFailed_RefundOneToOne() public {
        HarvestCampaign c = _createApproved();
        _fund(c, rina, 500e18);
        _fund(c, budi, 100e18);

        vm.expectRevert(HarvestCampaign.FundingStillOpen.selector);
        c.finalizeFunding();

        vm.warp(c.fundingDeadline() + 1);
        vm.startPrank(sari);
        usdt.approve(address(c), 200e18);
        vm.expectRevert(HarvestCampaign.FundingClosed.selector);
        c.fund(200e18);
        vm.stopPrank();

        vm.prank(outsider); // siapa pun boleh memanggil
        c.finalizeFunding();
        _assertStatus(c, HarvestCampaign.Status.Failed);
        assertEq(uint8(c.failType()), uint8(HarvestCampaign.FailType.Funding));

        uint256 r0 = usdt.balanceOf(rina);
        uint256 b0 = usdt.balanceOf(budi);
        vm.prank(rina);
        c.refund();
        vm.prank(budi);
        c.refund();
        assertEq(usdt.balanceOf(rina) - r0, 500e18);
        assertEq(usdt.balanceOf(budi) - b0, 100e18);
        assertEq(c.balanceOf(rina), 0);
        assertEq(c.totalSupply(), 0);
        assertEq(usdt.balanceOf(address(c)), 0);

        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.NothingToRefund.selector);
        c.refund();
        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.claim();
    }

    /// Milestone ditolak AI → unggah ulang → disetujui.
    function test_MilestoneRejectedByAI_ThenResubmitApproved() public {
        HarvestCampaign c = _createActive();
        uint256 f0 = usdt.balanceOf(farmer);

        _submit(c, "bafy-foto-salah");
        _ai(c, false);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.AIReviewed);
        _coop(c, true);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Rejected);
        assertEq(usdt.balanceOf(farmer), f0, "tidak ada dana cair");
        assertEq(rep.getAgentStats().rejections, 1);

        _submit(c, "bafy-foto-benar");
        HarvestCampaign.Milestone memory m = _milestone(c, 0);
        assertEq(uint8(m.status), uint8(HarvestCampaign.MStatus.ProofSubmitted));
        assertEq(m.attempts, 2);
        assertEq(m.proofCID, "bafy-foto-benar");
        assertFalse(m.aiDecided);
        assertFalse(m.verifierDecided);

        _ai(c, true);
        _coop(c, true);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Released);
        assertEq(usdt.balanceOf(farmer) - f0, 400e18);
        assertEq(c.currentMilestone(), 1);
    }

    /// Ditolak 3 kali → Disputed → resolveDispute(true) cair; recordOverturn tercatat.
    function test_ThreeRejections_Disputed_ResolveTrue() public {
        HarvestCampaign c = _createActive();
        for (uint256 i = 1; i <= 3; ++i) {
            _submit(c, "bafy-foto");
            _ai(c, false);
            _coop(c, true);
            if (i < 3) _assertMStatus(c, 0, HarvestCampaign.MStatus.Rejected);
        }
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Disputed);

        vm.prank(farmer);
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector);
        c.submitProof("bafy-foto-4");

        uint256 f0 = usdt.balanceOf(farmer);
        vm.prank(admin);
        c.resolveDispute(true);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Released);
        assertEq(usdt.balanceOf(farmer) - f0, 400e18);
        assertEq(rep.getAgentStats().overturned, 1);
        assertEq(rep.getAgentStats().rejections, 3);
    }

    /// Panen di bawah modal (800) → seluruhnya ke investor pro-rata.
    function test_HarvestBelowCapital_AllToInvestors() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        uint256 fBefore = usdt.balanceOf(farmer);
        _deposit(c, 800e18);
        assertEq(fBefore - usdt.balanceOf(farmer), 800e18, "petani tidak mendapat bagian");
        assertEq(usdt.balanceOf(address(reserve)), 0, "cadangan tidak mendapat bagian");
        assertEq(c.investorPool(), 800e18);

        assertEq(_claim(c, rina), 400e18);
        assertEq(_claim(c, budi), 240e18);
        assertEq(_claim(c, sari), 160e18);
        assertEq(usdt.balanceOf(address(c)), 0);
        assertEq(rep.getFarmerStats(farmer).totalReported, 800e18);
    }

    /// Gagal panen → markFailed → klaim sisa escrow → compensate → klaim lagi (kumulatif).
    function test_CropFailure_Compensation_CumulativeClaim() public {
        HarvestCampaign c = _createActive();
        _release(c); // 400 cair, sisa escrow 600

        vm.prank(admin);
        c.markFailed();
        _assertStatus(c, HarvestCampaign.Status.Failed);
        assertEq(uint8(c.failType()), uint8(HarvestCampaign.FailType.Crop));
        assertEq(c.investorPool(), 600e18);
        assertEq(c.totalSharesAtSettle(), 1_000e18);
        assertEq(rep.getFarmerStats(farmer).cropFailures, 1);

        assertEq(_claim(c, rina), 300e18);

        usdt.mint(address(reserve), 100e18); // saldo dana cadangan
        vm.prank(admin);
        reserve.compensate(address(c), 100e18);
        assertEq(c.investorPool(), 700e18);
        assertEq(reserve.totalCompensated(), 100e18);

        assertEq(_claim(c, rina), 50e18, "klaim kumulatif: 350 - 300");
        assertEq(_claim(c, budi), 210e18);
        assertEq(_claim(c, sari), 140e18);
        assertEq(usdt.balanceOf(address(c)), 0);

        vm.prank(farmer);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.submitProof("bafy-foto");
    }

    /// Default → markDefault setelah grace → petani diblokir membuat kampanye.
    function test_Default_AfterGrace_FarmerBlocked() public {
        HarvestCampaign c = _createActive();
        _release(c);
        uint64 harvestDate = c.getSummary().expectedHarvestDate;

        vm.warp(harvestDate + 30 days);
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.GracePeriodActive.selector);
        c.markDefault();

        vm.warp(harvestDate + 30 days + 1);
        vm.prank(admin);
        c.markDefault();
        _assertStatus(c, HarvestCampaign.Status.Defaulted);
        assertEq(c.investorPool(), 600e18);
        assertEq(rep.getFarmerStats(farmer).defaults, 1);
        assertTrue(rep.isBlocked(farmer));

        assertEq(_claim(c, rina), 300e18);
        assertEq(_claim(c, budi), 180e18);
        assertEq(_claim(c, sari), 120e18);

        // kompensasi juga berlaku untuk kampanye gagal bayar
        usdt.mint(address(reserve), 10e18);
        vm.prank(admin);
        reserve.compensate(address(c), 10e18);
        assertEq(_claim(c, rina), 5e18);

        vm.prank(farmer);
        vm.expectRevert(CampaignFactory.FarmerBlocked.selector);
        factory.createCampaign(_params());
    }
}
