// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {BaseTest} from "./BaseTest.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {HarvestCampaign, CampaignParams} from "../src/HarvestCampaign.sol";
import {IReputationBook, IReservePool} from "../src/interfaces/IBagiPanen.sol";

/// @dev Registri tiruan yang bisa dibuat me-revert (mis. identitas dibakar).
contract FlakyRegistry {
    address public holder;
    bool public broken;

    constructor(address holder_) {
        holder = holder_;
    }

    function breakIt() external {
        broken = true;
    }

    function ownerOf(uint256) external view returns (address) {
        require(!broken, "burned");
        return holder;
    }
}

contract CampaignFactoryTest is BaseTest {
    // ---------------- constructor & setModules ----------------

    function test_Constructor() public view {
        assertEq(factory.owner(), admin);
        assertEq(address(factory.usdt()), address(usdt));
        assertEq(factory.deployer().factory(), address(factory));
        assertEq(address(factory.reputationBook()), address(rep));
        assertEq(address(factory.reservePool()), address(reserve));
    }

    function test_Constructor_RevertsOnZeroUsdt() public {
        vm.expectRevert(CampaignFactory.ZeroAddress.selector);
        new CampaignFactory(IERC20(address(0)));
    }

    function test_SetModules_OnlyOnce() public {
        vm.prank(admin);
        vm.expectRevert(CampaignFactory.ModulesAlreadySet.selector);
        factory.setModules(IReputationBook(address(rep)), IReservePool(address(reserve)));
    }

    function test_SetModules_OnlyOwnerAndNonZero() public {
        vm.prank(admin);
        CampaignFactory f = new CampaignFactory(usdt);
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        f.setModules(IReputationBook(address(rep)), IReservePool(address(reserve)));
        vm.prank(admin);
        vm.expectRevert(CampaignFactory.ZeroAddress.selector);
        f.setModules(IReputationBook(address(0)), IReservePool(address(reserve)));
    }

    function test_CreateCampaign_RevertsWhenModulesNotSet() public {
        vm.startPrank(admin);
        CampaignFactory f = new CampaignFactory(usdt);
        f.registerCooperative(coop, "Koperasi");
        vm.stopPrank();
        vm.prank(coop);
        f.registerFarmer(farmer, "Darto");
        CampaignParams memory p = _params();
        vm.prank(farmer);
        vm.expectRevert(CampaignFactory.ModulesNotSet.selector);
        f.createCampaign(p);
    }

    // ---------------- registerCooperative ----------------

    function test_RegisterCooperative() public {
        address c2 = makeAddr("koperasi2");
        vm.expectEmit(address(factory));
        emit CampaignFactory.CooperativeRegistered(c2, "Koperasi Dua");
        vm.prank(admin);
        factory.registerCooperative(c2, "Koperasi Dua");
        assertTrue(factory.isCooperative(c2));
        assertEq(factory.cooperativeName(c2), "Koperasi Dua");
    }

    function test_RegisterCooperative_Reverts() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        factory.registerCooperative(outsider, "X");

        vm.startPrank(admin);
        vm.expectRevert(CampaignFactory.ZeroAddress.selector);
        factory.registerCooperative(address(0), "X");
        vm.expectRevert(CampaignFactory.EmptyName.selector);
        factory.registerCooperative(outsider, "");
        vm.expectRevert(CampaignFactory.AlreadyRegistered.selector);
        factory.registerCooperative(coop, "X");
        vm.expectRevert(CampaignFactory.RoleConflict.selector);
        factory.registerCooperative(farmer, "X");
        vm.expectRevert(CampaignFactory.RoleConflict.selector);
        factory.registerCooperative(admin, "X");
        vm.expectRevert(CampaignFactory.RoleConflict.selector);
        factory.registerCooperative(agent, "X");
        vm.stopPrank();
    }

    // ---------------- registerFarmer ----------------

    function test_RegisterFarmer() public {
        address f2 = makeAddr("petani2");
        vm.expectEmit(address(factory));
        emit CampaignFactory.FarmerRegistered(f2, coop, "Petani Dua");
        vm.prank(coop);
        factory.registerFarmer(f2, "Petani Dua");
        assertEq(factory.farmerCooperative(f2), coop);
        assertEq(factory.farmerName(f2), "Petani Dua");
    }

    function test_RegisterFarmer_Reverts() public {
        vm.prank(outsider);
        vm.expectRevert(CampaignFactory.NotCooperative.selector);
        factory.registerFarmer(makeAddr("x"), "X");

        vm.startPrank(coop);
        vm.expectRevert(CampaignFactory.ZeroAddress.selector);
        factory.registerFarmer(address(0), "X");
        vm.expectRevert(CampaignFactory.EmptyName.selector);
        factory.registerFarmer(outsider, "");
        vm.expectRevert(CampaignFactory.AlreadyRegistered.selector);
        factory.registerFarmer(farmer, "X");
        vm.expectRevert(CampaignFactory.RoleConflict.selector);
        factory.registerFarmer(coop, "X");
        vm.expectRevert(CampaignFactory.RoleConflict.selector);
        factory.registerFarmer(admin, "X");
        vm.expectRevert(CampaignFactory.RoleConflict.selector);
        factory.registerFarmer(agent, "X");
        vm.stopPrank();
    }

    // ---------------- createCampaign ----------------

    function test_CreateCampaign() public {
        CampaignParams memory p = _params();
        vm.prank(farmer);
        address addr = factory.createCampaign(p);
        HarvestCampaign c = HarvestCampaign(addr);

        assertTrue(factory.isCampaign(addr));
        assertEq(factory.campaignCount(), 1);
        assertEq(factory.getCampaigns()[0], addr);
        assertEq(factory.getCampaignsByFarmer(farmer)[0], addr);
        assertEq(c.farmer(), farmer);
        assertEq(c.cooperative(), coop);
        assertEq(c.factory(), address(factory));
        assertEq(c.symbol(), "BPS-1");
        _assertStatus(c, HarvestCampaign.Status.Draft);

        HarvestCampaign c2 = _create();
        assertEq(c2.symbol(), "BPS-2");
        assertEq(factory.getCampaignsByFarmer(farmer).length, 2);
        assertEq(factory.getCampaignsByFarmer(outsider).length, 0);
    }

    function test_CreateCampaign_EmitsEvent() public {
        CampaignParams memory p = _params();
        vm.expectEmit(false, false, false, false, address(factory));
        emit CampaignFactory.CampaignCreated(address(0), farmer);
        vm.prank(farmer);
        factory.createCampaign(p);
    }

    function test_CreateCampaign_RevertsForNonFarmer() public {
        CampaignParams memory p = _params();
        vm.prank(outsider);
        vm.expectRevert(CampaignFactory.NotRegisteredFarmer.selector);
        factory.createCampaign(p);
    }

    function test_CreateCampaign_RevertsOnInvalidParams() public {
        for (uint256 i; i < 9; ++i) {
            CampaignParams memory p = _params();
            if (i == 0) p.targetAmount = 0;
            if (i == 1) p.fundingDuration = 0;
            if (i == 2) p.expectedHarvestDate = uint64(block.timestamp);
            if (i == 3) p.commodity = "";
            if (i == 4) p.milestoneBps[2] = 2000; // total 9500
            if (i == 5) p.milestoneBps = new uint16[](2); // panjang tidak sama
            if (i == 6) {
                p.milestoneNames = new string[](0);
                p.milestoneBps = new uint16[](0);
            }
            if (i == 7) {
                p.milestoneBps[0] = 0;
                p.milestoneBps[1] = 7500;
            }
            if (i == 8) {
                p.milestoneNames = new string[](11);
                p.milestoneBps = new uint16[](11);
            }
            vm.prank(farmer);
            vm.expectRevert(CampaignFactory.InvalidParams.selector);
            factory.createCampaign(p);
        }
    }

    // ---------------- approve / reject ----------------

    function test_ApproveCampaign() public {
        HarvestCampaign c = _create();
        vm.expectEmit(address(factory));
        emit CampaignFactory.CampaignApproved(address(c));
        vm.prank(admin);
        factory.approveCampaign(address(c));
        _assertStatus(c, HarvestCampaign.Status.Funding);

        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        factory.approveCampaign(address(c));
    }

    function test_RejectCampaign() public {
        HarvestCampaign c = _create();
        vm.expectEmit(address(factory));
        emit CampaignFactory.CampaignRejected(address(c));
        vm.prank(admin);
        factory.rejectCampaign(address(c));
        _assertStatus(c, HarvestCampaign.Status.Cancelled);

        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        factory.approveCampaign(address(c));
    }

    function test_ApproveReject_Reverts() public {
        HarvestCampaign c = _create();
        vm.startPrank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        factory.approveCampaign(address(c));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        factory.rejectCampaign(address(c));
        vm.stopPrank();

        vm.startPrank(admin);
        vm.expectRevert(CampaignFactory.NotCampaign.selector);
        factory.approveCampaign(outsider);
        vm.expectRevert(CampaignFactory.NotCampaign.selector);
        factory.rejectCampaign(outsider);
        vm.stopPrank();
    }

    // ---------------- setAgent / isAgent ----------------

    function test_SetAgent() public {
        address agent2 = makeAddr("agent2");
        vm.prank(agent2);
        uint256 id2 = identity.register("ipfs://card2");
        vm.expectEmit(address(factory));
        emit CampaignFactory.AgentConfigured(address(identity), id2, agent2);
        vm.prank(admin);
        factory.setAgent(address(identity), id2, agent2);
        assertEq(factory.identityRegistry(), address(identity));
        assertEq(factory.agentId(), id2);
        assertEq(factory.agentWallet(), agent2);
        assertTrue(factory.isAgent(agent2));
        assertFalse(factory.isAgent(agent));
    }

    function test_SetAgent_Reverts() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        factory.setAgent(address(identity), agentId, agent);

        vm.startPrank(admin);
        vm.expectRevert(CampaignFactory.ZeroAddress.selector);
        factory.setAgent(address(0), agentId, agent);
        vm.expectRevert(CampaignFactory.ZeroAddress.selector);
        factory.setAgent(address(identity), agentId, address(0));
        // agen wajib independen
        vm.expectRevert(CampaignFactory.AgentNotIndependent.selector);
        factory.setAgent(address(identity), agentId, admin);
        vm.expectRevert(CampaignFactory.AgentNotIndependent.selector);
        factory.setAgent(address(identity), agentId, coop);
        vm.expectRevert(CampaignFactory.AgentNotIndependent.selector);
        factory.setAgent(address(identity), agentId, farmer);
        // wallet harus pemilik identitas
        vm.expectRevert(CampaignFactory.AgentNotOwner.selector);
        factory.setAgent(address(identity), agentId, outsider);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 99));
        factory.setAgent(address(identity), 99, agent);
        vm.stopPrank();
    }

    function test_IsAgent() public {
        assertTrue(factory.isAgent(agent));
        assertFalse(factory.isAgent(outsider));
        assertFalse(factory.isAgent(address(0)));

        vm.prank(agent);
        identity.transferFrom(agent, outsider, agentId);
        assertFalse(factory.isAgent(agent), "identitas pindah tangan");
        assertFalse(factory.isAgent(outsider), "bukan wallet agen terdaftar");
    }

    function test_IsAgent_FalseWhenRegistryReverts() public {
        FlakyRegistry reg = new FlakyRegistry(agent);
        vm.prank(admin);
        factory.setAgent(address(reg), 7, agent);
        assertTrue(factory.isAgent(agent));
        reg.breakIt();
        assertFalse(factory.isAgent(agent));
    }

    function test_RejectCampaign_RevertsWhenNotDraft() public {
        HarvestCampaign c = _createApproved();
        vm.prank(admin);
        vm.expectRevert(HarvestCampaign.InvalidStatus.selector);
        factory.rejectCampaign(address(c));
    }

    function test_IsAgent_FalseWhenNotConfigured() public {
        vm.prank(admin);
        CampaignFactory f = new CampaignFactory(usdt);
        assertFalse(f.isAgent(agent));
    }
}
