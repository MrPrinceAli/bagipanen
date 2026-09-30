// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {MockAgentIdentity} from "../src/MockAgentIdentity.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {HarvestCampaign, CampaignParams} from "../src/HarvestCampaign.sol";
import {ReputationBook} from "../src/ReputationBook.sol";
import {ReservePool} from "../src/ReservePool.sol";
import {ICampaignFactory, IReputationBook, IReservePool} from "../src/interfaces/IBagiPanen.sol";

/// @notice Setup bersama: deploy semua kontrak + data demo PRD (koperasi, Pak Darto, 3 investor, agen).
abstract contract BaseTest is Test {
    MockUSDT internal usdt;
    MockAgentIdentity internal identity;
    CampaignFactory internal factory;
    ReputationBook internal rep;
    ReservePool internal reserve;

    address internal admin = makeAddr("admin");
    address internal coop = makeAddr("koperasi");
    address internal farmer = makeAddr("darto");
    address internal agent = makeAddr("agent");
    address internal rina = makeAddr("rina");
    address internal budi = makeAddr("budi");
    address internal sari = makeAddr("sari");
    address internal outsider = makeAddr("outsider");
    uint256 internal agentId;

    uint256 internal constant TARGET = 1_000e18;
    uint256 internal constant EST_REVENUE = 1_650e18;
    uint64 internal constant FUNDING_DURATION = 600;
    uint64 internal constant HARVEST_IN = 120 days;

    function setUp() public virtual {
        vm.warp(1_790_000_000);

        vm.startPrank(admin);
        usdt = new MockUSDT();
        identity = new MockAgentIdentity();
        factory = new CampaignFactory(usdt);
        rep = new ReputationBook(ICampaignFactory(address(factory)));
        reserve = new ReservePool(ICampaignFactory(address(factory)), usdt);
        factory.setModules(IReputationBook(address(rep)), IReservePool(address(reserve)));
        factory.registerCooperative(coop, "Koperasi Tani Makmur, Garut");
        vm.stopPrank();

        vm.prank(coop);
        factory.registerFarmer(farmer, "Darto");

        vm.prank(agent);
        agentId = identity.register("ipfs://agent-card");
        vm.prank(admin);
        factory.setAgent(address(identity), agentId, agent);

        usdt.mint(rina, 5_000e18);
        usdt.mint(budi, 5_000e18);
        usdt.mint(sari, 5_000e18);
    }

    // ------------------------------------------------------------------
    // Helper
    // ------------------------------------------------------------------

    function _params() internal view returns (CampaignParams memory) {
        return _paramsWith(TARGET);
    }

    function _paramsWith(uint256 target) internal view returns (CampaignParams memory p) {
        string[] memory names = new string[](3);
        names[0] = "Tanam";
        names[1] = "Tumbuh";
        names[2] = "Pra-panen";
        uint16[] memory bps = new uint16[](3);
        bps[0] = 4000;
        bps[1] = 3500;
        bps[2] = 2500;
        p = CampaignParams({
            commodity: "Cabai merah",
            locationName: "Cikajang, Garut",
            latE6: -7_367_000,
            lonE6: 107_800_000,
            landAreaM2: 5000,
            targetAmount: target,
            estimatedRevenue: EST_REVENUE,
            fundingDuration: FUNDING_DURATION,
            expectedHarvestDate: uint64(block.timestamp + HARVEST_IN),
            metadataCID: "bafy-meta",
            milestoneNames: names,
            milestoneBps: bps
        });
    }

    function _create() internal returns (HarvestCampaign) {
        return _createWith(_params());
    }

    function _createWith(CampaignParams memory p) internal returns (HarvestCampaign c) {
        vm.prank(farmer);
        c = HarvestCampaign(factory.createCampaign(p));
    }

    function _createApproved() internal returns (HarvestCampaign c) {
        c = _create();
        vm.prank(admin);
        factory.approveCampaign(address(c));
    }

    function _createActive() internal returns (HarvestCampaign c) {
        c = _createApproved();
        _fundAll(c);
    }

    function _fund(HarvestCampaign c, address who, uint256 amount) internal {
        vm.startPrank(who);
        usdt.approve(address(c), amount);
        c.fund(amount);
        vm.stopPrank();
    }

    /// @dev Rina 500, Budi 300, Sari 200 (data demo PRD).
    function _fundAll(HarvestCampaign c) internal {
        _fund(c, rina, 500e18);
        _fund(c, budi, 300e18);
        _fund(c, sari, 200e18);
    }

    function _submit(HarvestCampaign c, string memory cid) internal {
        vm.prank(farmer);
        c.submitProof(cid);
    }

    function _ai(HarvestCampaign c, bool ok) internal {
        vm.prank(agent);
        c.recordVerdict(ok, "bafy-reason");
    }

    function _coop(HarvestCampaign c, bool ok) internal {
        vm.prank(coop);
        c.verifierDecision(ok);
    }

    function _release(HarvestCampaign c) internal {
        _submit(c, "bafy-proof");
        _ai(c, true);
        _coop(c, true);
    }

    function _releaseAll(HarvestCampaign c) internal {
        uint256 n = c.getMilestones().length;
        for (uint256 i; i < n; ++i) {
            _release(c);
        }
    }

    /// @dev Petani menyetor hasil panen (mint kekurangan saldo sebagai simulasi hasil penjualan).
    function _deposit(HarvestCampaign c, uint256 amount) internal {
        uint256 bal = usdt.balanceOf(farmer);
        if (bal < amount) _mintTo(farmer, amount - bal);
        vm.startPrank(farmer);
        usdt.approve(address(c), amount);
        c.depositHarvest(amount, "bafy-nota");
        vm.stopPrank();
    }

    function _claim(HarvestCampaign c, address who) internal returns (uint256 received) {
        uint256 before = usdt.balanceOf(who);
        vm.prank(who);
        c.claim();
        received = usdt.balanceOf(who) - before;
    }

    function _mintTo(address to, uint256 amount) internal {
        while (amount > 0) {
            uint256 a = amount > 10_000e18 ? 10_000e18 : amount;
            usdt.mint(to, a);
            amount -= a;
        }
    }

    function _milestone(HarvestCampaign c, uint256 i) internal view returns (HarvestCampaign.Milestone memory) {
        return c.getMilestones()[i];
    }

    function _assertStatus(HarvestCampaign c, HarvestCampaign.Status s) internal view {
        assertEq(uint8(c.status()), uint8(s), "status kampanye");
    }

    function _assertMStatus(HarvestCampaign c, uint256 i, HarvestCampaign.MStatus s) internal view {
        assertEq(uint8(_milestone(c, i).status), uint8(s), "status milestone");
    }
}
