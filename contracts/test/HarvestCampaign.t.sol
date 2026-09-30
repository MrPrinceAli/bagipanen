// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./BaseTest.sol";
import {HarvestCampaign} from "../src/HarvestCampaign.sol";
import {ReputationBook} from "../src/ReputationBook.sol";

contract HarvestCampaignTest is BaseTest {
    // ---------------- metadata & view ----------------

    function test_TokenMetadataAndModules() public {
        HarvestCampaign c = _create();
        assertEq(c.name(), "BagiPanen Share");
        assertEq(c.symbol(), "BPS-1");
        assertEq(c.decimals(), 18);
        assertEq(c.campaignId(), 1);
        assertEq(address(c.usdt()), address(usdt));
        assertEq(address(c.reputationBook()), address(rep));
        assertEq(address(c.reservePool()), address(reserve));
    }

    function test_GetSummary() public {
        HarvestCampaign c = _createActive();
        HarvestCampaign.Summary memory s = c.getSummary();
        assertEq(s.campaignId, 1);
        assertEq(s.farmer, farmer);
        assertEq(s.cooperative, coop);
        assertEq(uint8(s.status), uint8(HarvestCampaign.Status.Active));
        assertEq(uint8(s.failType), uint8(HarvestCampaign.FailType.None));
        assertEq(s.commodity, "Cabai merah");
        assertEq(s.locationName, "Cikajang, Garut");
        assertEq(s.latE6, -7_367_000);
        assertEq(s.lonE6, 107_800_000);
        assertEq(s.landAreaM2, 5000);
        assertEq(s.targetAmount, TARGET);
        assertEq(s.estimatedRevenue, EST_REVENUE);
        assertEq(s.raisedAmount, TARGET);
        assertEq(s.fundingDeadline, c.fundingDeadline());
        assertEq(s.expectedHarvestDate, block.timestamp + HARVEST_IN);
        assertEq(s.metadataCID, "bafy-meta");
        assertEq(s.currentMilestone, 0);
        assertEq(s.milestoneCount, 3);
        assertEq(s.totalReleased, 0);
    }

    function test_GetMilestones() public {
        HarvestCampaign c = _create();
        HarvestCampaign.Milestone[] memory ms = c.getMilestones();
        assertEq(ms.length, 3);
        assertEq(ms[0].name, "Tanam");
        assertEq(ms[1].name, "Tumbuh");
        assertEq(ms[2].name, "Pra-panen");
        assertEq(ms[0].bps, 4000);
        assertEq(ms[1].bps, 3500);
        assertEq(ms[2].bps, 2500);
        for (uint256 i; i < 3; ++i) {
            assertEq(uint8(ms[i].status), uint8(HarvestCampaign.MStatus.Pending));
            assertEq(ms[i].attempts, 0);
        }
    }

    // ---------------- fund / finalizeFunding / refund ----------------

    function test_Fund_Partial_ThenFull() public {
        HarvestCampaign c = _createApproved();
        vm.startPrank(rina);
        usdt.approve(address(c), 500e18);
        vm.expectEmit(address(c));
        emit HarvestCampaign.Funded(rina, 500e18);
        c.fund(500e18);
        vm.stopPrank();
        _assertStatus(c, HarvestCampaign.Status.Funding);
        assertEq(rep.getFarmerStats(farmer).campaignsFunded, 0);

        _fund(c, budi, 300e18);
        vm.startPrank(sari);
        usdt.approve(address(c), 200e18);
        vm.expectEmit(address(c));
        emit HarvestCampaign.FundingSucceeded(TARGET);
        c.fund(200e18);
        vm.stopPrank();
        _assertStatus(c, HarvestCampaign.Status.Active);
        assertEq(usdt.balanceOf(address(c)), TARGET);
        assertEq(c.totalSupply(), TARGET);
    }

    function test_Fund_Reverts() public {
        HarvestCampaign c = _create();
        vm.startPrank(rina);
        usdt.approve(address(c), type(uint256).max);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // masih Draft
        c.fund(100e18);
        vm.stopPrank();

        vm.prank(admin);
        factory.approveCampaign(address(c));
        vm.startPrank(rina);
        vm.expectRevert(HarvestCampaign.ZeroAmount.selector);
        c.fund(0);
        vm.expectRevert(HarvestCampaign.ExceedsTarget.selector);
        c.fund(TARGET + 1);
        c.fund(900e18);
        vm.expectRevert(HarvestCampaign.ExceedsTarget.selector); // dibatasi sisa target
        c.fund(100e18 + 1);
        c.fund(100e18);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // sudah Active
        c.fund(1);
        vm.stopPrank();
    }

    function test_Fund_AllowedExactlyAtDeadline() public {
        HarvestCampaign c = _createApproved();
        vm.warp(c.fundingDeadline());
        _fund(c, rina, 100e18);
        assertEq(c.raisedAmount(), 100e18);
    }

    function test_FinalizeFunding_Reverts() public {
        HarvestCampaign c = _create();
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // Draft
        c.finalizeFunding();

        vm.prank(admin);
        factory.approveCampaign(address(c));
        vm.warp(c.fundingDeadline());
        vm.expectRevert(HarvestCampaign.FundingStillOpen.selector);
        c.finalizeFunding();

        HarvestCampaign full = _createActive();
        vm.warp(full.fundingDeadline() + 1);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // sudah Active
        full.finalizeFunding();
    }

    function test_Refund_RevertsWhenNotFundingFailure() public {
        HarvestCampaign c = _createApproved();
        _fund(c, rina, 100e18);
        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.refund();

        HarvestCampaign active = _createActive();
        vm.prank(admin);
        active.markFailed(); // Failed tipe Crop → pakai claim, bukan refund
        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        active.refund();
    }

    // ---------------- submitProof ----------------

    function test_SubmitProof() public {
        HarvestCampaign c = _createActive();
        vm.expectEmit(address(c));
        emit HarvestCampaign.ProofSubmitted(0, "bafy-foto", 1);
        _submit(c, "bafy-foto");
        HarvestCampaign.Milestone memory m = _milestone(c, 0);
        assertEq(uint8(m.status), uint8(HarvestCampaign.MStatus.ProofSubmitted));
        assertEq(m.proofCID, "bafy-foto");
        assertEq(m.attempts, 1);
        assertEq(m.submittedAt, block.timestamp);
    }

    function test_SubmitProof_Reverts() public {
        HarvestCampaign funding = _createApproved();
        vm.prank(farmer);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        funding.submitProof("bafy-foto");

        HarvestCampaign c = _createActive();
        vm.startPrank(farmer);
        vm.expectRevert(HarvestCampaign.EmptyCID.selector);
        c.submitProof("");
        c.submitProof("bafy-foto");
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector); // masih menunggu putusan
        c.submitProof("bafy-foto-2");
        vm.stopPrank();

        _ai(c, true);
        vm.prank(farmer);
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector); // AIReviewed
        c.submitProof("bafy-foto-2");
    }

    function test_SubmitProof_SequentialAndNoMilestoneLeft() public {
        HarvestCampaign c = _createActive();
        _release(c);
        assertEq(c.currentMilestone(), 1);
        _submit(c, "bafy-tumbuh");
        _assertMStatus(c, 1, HarvestCampaign.MStatus.ProofSubmitted);
        _ai(c, true);
        _coop(c, true);
        _release(c);
        vm.prank(farmer);
        vm.expectRevert(HarvestCampaign.NoMilestoneLeft.selector);
        c.submitProof("bafy-foto");
    }

    // ---------------- recordVerdict / verifierDecision ----------------

    function test_RecordVerdict() public {
        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        vm.expectEmit(address(c));
        emit HarvestCampaign.VerdictRecorded(0, true, "bafy-reason");
        _ai(c, true);
        HarvestCampaign.Milestone memory m = _milestone(c, 0);
        assertTrue(m.aiDecided);
        assertTrue(m.aiApproved);
        assertEq(m.aiReasonCID, "bafy-reason");
        assertEq(uint8(m.status), uint8(HarvestCampaign.MStatus.AIReviewed));
        assertEq(rep.getAgentStats().verdicts, 1);
        assertEq(rep.getAgentStats().approvals, 1);
    }

    function test_RecordVerdict_Reverts() public {
        HarvestCampaign c = _createActive();
        vm.startPrank(agent);
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector); // belum ada bukti
        c.recordVerdict(true, "bafy-reason");
        vm.stopPrank();

        _submit(c, "bafy-foto");
        vm.startPrank(agent);
        vm.expectRevert(HarvestCampaign.EmptyCID.selector);
        c.recordVerdict(true, "");
        c.recordVerdict(true, "bafy-reason");
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector); // sudah diputus
        c.recordVerdict(false, "bafy-reason");
        vm.stopPrank();
    }

    function test_VerifierDecision() public {
        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        vm.expectEmit(address(c));
        emit HarvestCampaign.VerifierDecided(0, true);
        _coop(c, true);
        HarvestCampaign.Milestone memory m = _milestone(c, 0);
        assertTrue(m.verifierDecided);
        assertTrue(m.verifierApproved);
        // koperasi memutuskan lebih dulu → status tetap menunggu AI
        assertEq(uint8(m.status), uint8(HarvestCampaign.MStatus.ProofSubmitted));

        vm.expectEmit(address(c));
        emit HarvestCampaign.TrancheReleased(0, 400e18);
        _ai(c, true);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Released);
    }

    function test_VerifierDecision_Reverts() public {
        HarvestCampaign c = _createActive();
        vm.prank(coop);
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector); // belum ada bukti
        c.verifierDecision(true);

        _submit(c, "bafy-foto");
        _coop(c, false);
        vm.prank(coop);
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector); // sudah diputus
        c.verifierDecision(true);
    }

    function test_CooperativeRejects_AIApproves_Rejected() public {
        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        _ai(c, true);
        vm.expectEmit(address(c));
        emit HarvestCampaign.MilestoneRejected(0);
        _coop(c, false);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Rejected);
        assertEq(c.totalReleased(), 0);
    }

    // ---------------- resolveDispute ----------------

    function _dispute(HarvestCampaign c, bool aiOk, bool coopOk) internal {
        for (uint256 i; i < 3; ++i) {
            _submit(c, "bafy-foto");
            _ai(c, aiOk);
            _coop(c, coopOk);
        }
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Disputed);
    }

    function test_ResolveDispute_False_IsFinal() public {
        HarvestCampaign c = _createActive();
        _dispute(c, false, false);
        vm.prank(admin);
        c.resolveDispute(false);
        _assertMStatus(c, 0, HarvestCampaign.MStatus.Rejected);
        assertEq(rep.getAgentStats().overturned, 0, "admin sependapat dengan AI");

        vm.prank(farmer);
        vm.expectRevert(HarvestCampaign.TooManyAttempts.selector);
        c.submitProof("bafy-foto-4");

        // admin kemudian bisa menandai gagal
        vm.prank(admin);
        c.markFailed();
        assertEq(c.investorPool(), TARGET);
    }

    function test_ResolveDispute_OverturnOnlyWhenAgainstAI() public {
        // AI setuju, koperasi menolak 3x, admin menyetujui → putusan AI dikuatkan
        HarvestCampaign c1 = _createActive();
        _dispute(c1, true, false);
        vm.prank(admin);
        c1.resolveDispute(true);
        assertEq(rep.getAgentStats().overturned, 0);

        // AI setuju, admin menolak → putusan AI dibatalkan
        HarvestCampaign c2 = _createActive();
        _dispute(c2, true, false);
        vm.prank(admin);
        c2.resolveDispute(false);
        assertEq(rep.getAgentStats().overturned, 1);
    }

    function test_ResolveDispute_RevertsWhenNotDisputed() public {
        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidMilestoneStatus.selector);
        c.resolveDispute(true);
    }

    // ---------------- depositHarvest ----------------

    function test_DepositHarvest_Reverts() public {
        HarvestCampaign c = _createActive();
        _mintTo(farmer, 2_000e18);
        vm.startPrank(farmer);
        usdt.approve(address(c), type(uint256).max);
        vm.expectRevert(HarvestCampaign.MilestonesIncomplete.selector);
        c.depositHarvest(1_650e18, "bafy-nota");
        vm.stopPrank();

        _releaseAll(c);
        vm.startPrank(farmer);
        vm.expectRevert(HarvestCampaign.ZeroAmount.selector);
        c.depositHarvest(0, "bafy-nota");
        vm.expectRevert(HarvestCampaign.EmptyCID.selector);
        c.depositHarvest(1_650e18, "");
        c.depositHarvest(1_650e18, "bafy-nota");
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // sudah Harvested
        c.depositHarvest(1_650e18, "bafy-nota");
        vm.stopPrank();
    }

    function test_DepositHarvest_EmitsEvent() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        _mintTo(farmer, 650e18);
        vm.startPrank(farmer);
        usdt.approve(address(c), 1_650e18);
        vm.expectEmit(address(c));
        emit HarvestCampaign.HarvestDeposited(1_650e18, "bafy-nota");
        c.depositHarvest(1_650e18, "bafy-nota");
        vm.stopPrank();
    }

    function test_DepositHarvest_ExactlyCapital() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        _deposit(c, TARGET);
        assertEq(c.investorPool(), TARGET);
        assertEq(usdt.balanceOf(address(reserve)), 0);
    }

    function test_DepositHarvest_LateIsNotOnTime() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        vm.warp(c.getSummary().expectedHarvestDate + 7 days + 1);
        _deposit(c, 1_650e18);
        ReputationBook.FarmerStats memory fs = rep.getFarmerStats(farmer);
        assertEq(fs.harvestsCompleted, 1);
        assertEq(fs.onTimeHarvests, 0);
    }

    function test_DepositHarvest_OnTimeAtWindowEdge() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        vm.warp(c.getSummary().expectedHarvestDate + 7 days);
        _deposit(c, 1_650e18);
        assertEq(rep.getFarmerStats(farmer).onTimeHarvests, 1);
    }

    // ---------------- markFailed / markDefault ----------------

    function test_MarkFailed_RevertsWhenNotActive() public {
        HarvestCampaign c = _createApproved();
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.markFailed();
    }

    function test_MarkFailed_EmitsEvent() public {
        HarvestCampaign c = _createActive();
        vm.expectEmit(address(c));
        emit HarvestCampaign.CampaignFailed(TARGET);
        vm.prank(admin);
        c.markFailed();
    }

    function test_MarkDefault_RevertsWhenNotActive() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        _deposit(c, 1_650e18);
        vm.warp(block.timestamp + 365 days);
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.markDefault();
    }

    function test_MarkDefault_EmitsEvent() public {
        HarvestCampaign c = _createActive();
        vm.warp(c.getSummary().expectedHarvestDate + 31 days);
        vm.expectEmit(address(c));
        emit HarvestCampaign.CampaignDefaulted(TARGET);
        vm.prank(admin);
        c.markDefault();
    }

    // ---------------- addCompensation / claim / claimable ----------------

    function test_AddCompensation_RevertsInWrongStatus() public {
        HarvestCampaign c = _createActive();
        usdt.mint(address(reserve), 100e18);
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // masih Active
        reserve.compensate(address(c), 100e18);

        _releaseAll(c);
        _deposit(c, 1_650e18);
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector); // Harvested
        reserve.compensate(address(c), 100e18);
    }

    function test_AddCompensation_EmitsEvent() public {
        HarvestCampaign c = _createActive();
        vm.prank(admin);
        c.markFailed();
        usdt.mint(address(reserve), 100e18);
        vm.expectEmit(address(c));
        emit HarvestCampaign.CompensationAdded(100e18);
        vm.prank(admin);
        reserve.compensate(address(c), 100e18);
    }

    function test_Claim_Reverts() public {
        HarvestCampaign c = _createActive();
        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.claim();

        _releaseAll(c);
        _deposit(c, 1_650e18);
        vm.prank(outsider);
        vm.expectRevert(HarvestCampaign.NothingToClaim.selector);
        c.claim();
    }

    function test_Claim_EmitsEventAndTracksPaidOut() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        _deposit(c, 1_650e18);
        vm.expectEmit(address(c));
        emit HarvestCampaign.Claimed(rina, 630e18);
        vm.prank(rina);
        c.claim();
        assertEq(c.paidOut(rina), 630e18);
        assertEq(c.claimable(rina), 0);
    }

    function test_Claimable() public {
        HarvestCampaign c = _createActive();
        assertEq(c.claimable(rina), 0, "belum bisa diklaim saat Active");
        _releaseAll(c);
        _deposit(c, 1_650e18);
        assertEq(c.claimable(rina), 630e18);
        assertEq(c.claimable(budi), 378e18);
        assertEq(c.claimable(sari), 252e18);
        assertEq(c.claimable(outsider), 0);
    }
}
