// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BaseTest} from "./BaseTest.sol";
import {HarvestCampaign} from "../src/HarvestCampaign.sol";
import {ReservePool} from "../src/ReservePool.sol";

/// @notice Kontrol akses wajib dari PRD.
contract AccessControlTest is BaseTest {
    function test_NonAgentCannotRecordVerdict() public {
        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        address[4] memory notAgents = [outsider, farmer, coop, admin];
        for (uint256 i; i < notAgents.length; ++i) {
            vm.prank(notAgents[i]);
            vm.expectRevert(HarvestCampaign.NotAgent.selector);
            c.recordVerdict(true, "bafy-reason");
        }
    }

    function test_AgentLosesRightsWhenIdentityTransferred() public {
        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        vm.prank(agent);
        identity.transferFrom(agent, outsider, agentId);
        assertFalse(factory.isAgent(agent));

        vm.prank(agent);
        vm.expectRevert(HarvestCampaign.NotAgent.selector);
        c.recordVerdict(true, "bafy-reason");
    }

    function test_OtherCooperativeCannotDecide() public {
        address coop2 = makeAddr("koperasi-lain");
        vm.prank(admin);
        factory.registerCooperative(coop2, "Koperasi Lain");

        HarvestCampaign c = _createActive();
        _submit(c, "bafy-foto");
        vm.prank(coop2);
        vm.expectRevert(HarvestCampaign.NotCooperative.selector);
        c.verifierDecision(true);

        vm.prank(outsider);
        vm.expectRevert(HarvestCampaign.NotCooperative.selector);
        c.verifierDecision(true);
    }

    function test_ShareTokenNonTransferable() public {
        HarvestCampaign c = _createActive();
        vm.prank(rina);
        vm.expectRevert(HarvestCampaign.NonTransferable.selector);
        c.transfer(outsider, 1e18);

        vm.prank(rina);
        c.approve(outsider, 1e18);
        vm.prank(outsider);
        vm.expectRevert(HarvestCampaign.NonTransferable.selector);
        c.transferFrom(rina, outsider, 1e18);

        assertEq(c.balanceOf(rina), 500e18);
    }

    function test_AdminCannotWithdrawEscrow() public {
        HarvestCampaign c = _createActive();
        _release(c);
        uint256 escrow = usdt.balanceOf(address(c));
        assertEq(escrow, 600e18);

        // Admin tidak punya porsi → tidak bisa klaim / refund
        vm.startPrank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.claim();
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        c.refund();
        // Admin bukan petani → tidak bisa mengajukan bukti atau menyetor panen
        vm.expectRevert(HarvestCampaign.NotFarmer.selector);
        c.submitProof("bafy-foto");
        vm.stopPrank();

        // Satu-satunya aksi admin atas escrow (markFailed) mengalihkan dana ke pool investor
        vm.prank(admin);
        c.markFailed();
        assertEq(usdt.balanceOf(admin), 0);
        assertEq(c.investorPool(), escrow);
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.NothingToClaim.selector);
        c.claim();
        assertEq(usdt.balanceOf(address(c)), escrow, "escrow utuh untuk investor");

        // Dana cadangan hanya bisa disalurkan ke kampanye resmi
        usdt.mint(address(reserve), 100e18);
        vm.prank(admin);
        vm.expectRevert(ReservePool.NotCampaign.selector);
        reserve.compensate(admin, 100e18);
    }

    function test_FarmerAndCooperativeCannotFund() public {
        HarvestCampaign c = _createApproved();
        usdt.mint(farmer, 100e18);
        usdt.mint(coop, 100e18);

        vm.startPrank(farmer);
        usdt.approve(address(c), 100e18);
        vm.expectRevert(HarvestCampaign.NotAllowedToFund.selector);
        c.fund(100e18);
        vm.stopPrank();

        vm.startPrank(coop);
        usdt.approve(address(c), 100e18);
        vm.expectRevert(HarvestCampaign.NotAllowedToFund.selector);
        c.fund(100e18);
        vm.stopPrank();
    }

    function test_OnlyFactoryCanStartOrCancel() public {
        HarvestCampaign c = _create();
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.NotFactory.selector);
        c.startFunding();
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.NotFactory.selector);
        c.cancel();
    }

    function test_OnlyFarmerCanSubmitAndDeposit() public {
        HarvestCampaign c = _createActive();
        vm.prank(outsider);
        vm.expectRevert(HarvestCampaign.NotFarmer.selector);
        c.submitProof("bafy-foto");

        _releaseAll(c);
        vm.prank(coop);
        vm.expectRevert(HarvestCampaign.NotFarmer.selector);
        c.depositHarvest(1_650e18, "bafy-nota");
    }

    function test_OnlyAdminCanResolveFailOrDefault() public {
        HarvestCampaign c = _createActive();
        address[3] memory notAdmins = [outsider, coop, farmer];
        for (uint256 i; i < notAdmins.length; ++i) {
            vm.startPrank(notAdmins[i]);
            vm.expectRevert(HarvestCampaign.NotAdmin.selector);
            c.resolveDispute(true);
            vm.expectRevert(HarvestCampaign.NotAdmin.selector);
            c.markFailed();
            vm.expectRevert(HarvestCampaign.NotAdmin.selector);
            c.markDefault();
            vm.stopPrank();
        }
    }

    function test_OnlyReservePoolCanAddCompensation() public {
        HarvestCampaign c = _createActive();
        vm.prank(admin);
        c.markFailed();
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.NotReservePool.selector);
        c.addCompensation(100e18);
    }

    function test_OnlyOwnerCanCompensate() public {
        HarvestCampaign c = _createActive();
        vm.prank(admin);
        c.markFailed();
        usdt.mint(address(reserve), 100e18);
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        reserve.compensate(address(c), 100e18);
    }
}
