// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./BaseTest.sol";
import {HarvestCampaign} from "../src/HarvestCampaign.sol";

/// @notice Pembulatan: total yang keluar tidak pernah melebihi saldo kontrak.
contract RoundingTest is BaseTest {
    uint256 internal constant MAX_TARGET = 100_000e18;

    /// @dev Kampanye dengan target acak, didanai 3 investor dengan porsi acak (sampai satuan wei).
    function _fundedWith(uint256 target, uint256 a, uint256 b) internal returns (HarvestCampaign c) {
        uint256 fa = bound(a, 1, target - 2);
        uint256 fb = bound(b, 1, target - fa - 1);
        uint256 fc = target - fa - fb;
        _mintTo(rina, fa);
        _mintTo(budi, fb);
        _mintTo(sari, fc);
        c = _createWith(_paramsWith(target));
        vm.prank(admin);
        factory.approveCampaign(address(c));
        _fund(c, rina, fa);
        _fund(c, budi, fb);
        _fund(c, sari, fc);
    }

    function testFuzz_ReleasesExactlyRaised(uint256 target, uint256 a, uint256 b) public {
        target = bound(target, 3, MAX_TARGET);
        HarvestCampaign c = _fundedWith(target, a, b);
        uint256 f0 = usdt.balanceOf(farmer);
        _releaseAll(c);
        assertEq(c.totalReleased(), target);
        assertEq(usdt.balanceOf(farmer) - f0, target);
        assertEq(usdt.balanceOf(address(c)), 0);
    }

    function testFuzz_HarvestPayoutsNeverExceedBalance(uint256 target, uint256 a, uint256 b, uint256 harvest) public {
        target = bound(target, 3, MAX_TARGET);
        harvest = bound(harvest, 1, 3 * MAX_TARGET);
        HarvestCampaign c = _fundedWith(target, a, b);
        _releaseAll(c);

        uint256 bal = usdt.balanceOf(farmer);
        if (bal < harvest) _mintTo(farmer, harvest - bal);
        uint256 fBefore = usdt.balanceOf(farmer);
        _deposit(c, harvest);

        uint256 farmerShare = usdt.balanceOf(farmer) + harvest - fBefore;
        uint256 reserveShare = usdt.balanceOf(address(reserve));
        uint256 pool = c.investorPool();
        assertEq(farmerShare + reserveShare + pool, harvest, "konservasi dana panen");
        if (harvest >= target) {
            assertEq(farmerShare, (harvest - target) * 5_500 / 10_000);
            assertEq(reserveShare, (harvest - target) * 500 / 10_000);
        } else {
            assertEq(pool, harvest, "di bawah modal: semua ke investor");
            assertEq(farmerShare + reserveShare, 0);
        }

        uint256 paid = _claimIfAny(c, rina) + _claimIfAny(c, budi) + _claimIfAny(c, sari);
        assertLe(paid, pool);
        assertEq(usdt.balanceOf(address(c)), pool - paid);
        assertLe(pool - paid, 2, "debu pembulatan maksimal 2 wei");
    }

    function testFuzz_CropFailureCumulativeNeverExceedsBalance(
        uint256 target,
        uint256 a,
        uint256 b,
        uint256 comp1,
        uint256 comp2
    ) public {
        target = bound(target, 3, MAX_TARGET);
        comp1 = bound(comp1, 1, 10_000e18);
        comp2 = bound(comp2, 1, 10_000e18);
        HarvestCampaign c = _fundedWith(target, a, b);
        _release(c);
        vm.prank(admin);
        c.markFailed();

        uint256 paid = _claimIfAny(c, rina);
        usdt.mint(address(reserve), comp1);
        vm.prank(admin);
        reserve.compensate(address(c), comp1);
        paid += _claimIfAny(c, rina) + _claimIfAny(c, budi);
        usdt.mint(address(reserve), comp2);
        vm.prank(admin);
        reserve.compensate(address(c), comp2);
        paid += _claimIfAny(c, rina) + _claimIfAny(c, budi) + _claimIfAny(c, sari);

        uint256 pool = c.investorPool();
        assertLe(paid, pool);
        assertEq(usdt.balanceOf(address(c)), pool - paid);
        assertLe(pool - paid, 2, "debu pembulatan maksimal 2 wei");
    }

    function _claimIfAny(HarvestCampaign c, address who) internal returns (uint256) {
        if (c.claimable(who) == 0) return 0;
        return _claim(c, who);
    }
}
