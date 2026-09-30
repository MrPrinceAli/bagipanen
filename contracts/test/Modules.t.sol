// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BaseTest} from "./BaseTest.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {MockAgentIdentity} from "../src/MockAgentIdentity.sol";
import {CampaignDeployer} from "../src/CampaignDeployer.sol";
import {HarvestCampaign} from "../src/HarvestCampaign.sol";
import {ReputationBook} from "../src/ReputationBook.sol";
import {ReservePool} from "../src/ReservePool.sol";
import {ICampaignFactory} from "../src/interfaces/IBagiPanen.sol";

contract MockUSDTTest is BaseTest {
    function test_Metadata() public view {
        assertEq(usdt.name(), "Mock USDT");
        assertEq(usdt.symbol(), "mUSDT");
        assertEq(usdt.decimals(), 18);
    }

    function test_Mint_OpenToAnyone_UpToLimit() public {
        vm.prank(outsider);
        usdt.mint(outsider, 10_000e18);
        assertEq(usdt.balanceOf(outsider), 10_000e18);
    }

    function test_Mint_RevertsAboveLimit() public {
        vm.expectRevert(MockUSDT.MintTooLarge.selector);
        usdt.mint(outsider, 10_000e18 + 1);
    }
}

contract MockAgentIdentityTest is BaseTest {
    function test_Register() public {
        address a2 = makeAddr("agent2");
        vm.expectEmit(address(identity));
        emit MockAgentIdentity.AgentRegistered(2, a2, "ipfs://card2");
        vm.prank(a2);
        uint256 id = identity.register("ipfs://card2");
        assertEq(id, 2);
        assertEq(identity.totalAgents(), 2);
        assertEq(identity.ownerOf(id), a2);
        assertEq(identity.tokenURI(id), "ipfs://card2");
        assertEq(identity.ownerOf(agentId), agent);
        assertEq(identity.tokenURI(agentId), "ipfs://agent-card");
    }
}

contract CampaignDeployerTest is BaseTest {
    function test_Deploy_OnlyFactory() public {
        CampaignDeployer d = factory.deployer();
        vm.prank(outsider);
        vm.expectRevert(CampaignDeployer.NotFactory.selector);
        d.deploy(1, farmer, coop, _params());
    }
}

contract ReservePoolTest is BaseTest {
    function test_Constructor() public {
        assertEq(reserve.owner(), admin);
        assertEq(address(reserve.factory()), address(factory));
        assertEq(address(reserve.usdt()), address(usdt));
        vm.expectRevert(ReservePool.ZeroAddress.selector);
        new ReservePool(ICampaignFactory(address(0)), usdt);
        vm.expectRevert(ReservePool.ZeroAddress.selector);
        new ReservePool(ICampaignFactory(address(factory)), IERC20(address(0)));
    }

    function test_Contribute_OnlyCampaign() public {
        vm.prank(outsider);
        vm.expectRevert(ReservePool.NotCampaign.selector);
        reserve.contribute(1e18);
    }

    function test_Contribute_FromHarvest() public {
        HarvestCampaign c = _createActive();
        _releaseAll(c);
        _mintTo(farmer, 650e18);
        vm.startPrank(farmer);
        usdt.approve(address(c), 1_650e18);
        vm.expectEmit(address(reserve));
        emit ReservePool.Contributed(address(c), 32.5e18);
        c.depositHarvest(1_650e18, "bafy-nota");
        vm.stopPrank();
        assertEq(reserve.totalContributed(), 32.5e18);
        assertEq(reserve.balance(), 32.5e18);
    }

    function test_Compensate() public {
        HarvestCampaign c = _createActive();
        vm.prank(admin);
        c.markFailed();
        usdt.mint(address(reserve), 50e18);
        assertEq(reserve.balance(), 50e18);

        vm.expectEmit(address(reserve));
        emit ReservePool.Compensated(address(c), 20e18);
        vm.prank(admin);
        reserve.compensate(address(c), 20e18);
        assertEq(reserve.balance(), 30e18);
        assertEq(reserve.totalCompensated(), 20e18);
        assertEq(c.investorPool(), TARGET + 20e18);
        assertEq(usdt.balanceOf(address(c)), TARGET + 20e18);
    }

    function test_Compensate_Reverts() public {
        HarvestCampaign c = _createActive();
        vm.prank(admin);
        c.markFailed();

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, outsider));
        reserve.compensate(address(c), 1e18);

        vm.startPrank(admin);
        vm.expectRevert(ReservePool.NotCampaign.selector);
        reserve.compensate(outsider, 1e18);
        vm.expectRevert(ReservePool.ZeroAmount.selector);
        reserve.compensate(address(c), 0);
        vm.expectRevert(); // saldo dana cadangan kosong
        reserve.compensate(address(c), 1e18);
        vm.stopPrank();
    }
}

contract ReputationBookTest is BaseTest {
    function test_Constructor() public {
        assertEq(address(rep.factory()), address(factory));
        vm.expectRevert(ReputationBook.ZeroAddress.selector);
        new ReputationBook(ICampaignFactory(address(0)));
    }

    function test_WritesOnlyFromCampaign() public {
        vm.startPrank(outsider);
        vm.expectRevert(ReputationBook.NotCampaign.selector);
        rep.recordFunded(farmer);
        vm.expectRevert(ReputationBook.NotCampaign.selector);
        rep.recordHarvest(farmer, 1, 1, true);
        vm.expectRevert(ReputationBook.NotCampaign.selector);
        rep.recordCropFailure(farmer);
        vm.expectRevert(ReputationBook.NotCampaign.selector);
        rep.recordDefault(farmer);
        vm.expectRevert(ReputationBook.NotCampaign.selector);
        rep.recordVerdict(true);
        vm.expectRevert(ReputationBook.NotCampaign.selector);
        rep.recordOverturn();
        vm.stopPrank();
    }

    function test_WritesFromCampaign() public {
        HarvestCampaign c = _createActive();
        vm.startPrank(address(c));
        rep.recordFunded(outsider);
        rep.recordHarvest(outsider, 900e18, 1_000e18, false);
        rep.recordCropFailure(outsider);
        rep.recordDefault(outsider);
        rep.recordVerdict(false);
        rep.recordOverturn();
        vm.stopPrank();

        ReputationBook.FarmerStats memory fs = rep.getFarmerStats(outsider);
        assertEq(fs.campaignsFunded, 1);
        assertEq(fs.harvestsCompleted, 1);
        assertEq(fs.onTimeHarvests, 0);
        assertEq(fs.cropFailures, 1);
        assertEq(fs.defaults, 1);
        assertEq(fs.totalReported, 900e18);
        assertEq(fs.totalEstimated, 1_000e18);
        assertTrue(rep.isBlocked(outsider));

        ReputationBook.AgentStats memory ag = rep.getAgentStats();
        assertEq(ag.verdicts, 1);
        assertEq(ag.rejections, 1);
        assertEq(ag.overturned, 1);
    }

    function test_DefaultViews() public view {
        ReputationBook.FarmerStats memory fs = rep.getFarmerStats(farmer);
        assertEq(fs.campaignsFunded + fs.harvestsCompleted + fs.defaults, 0);
        assertFalse(rep.isBlocked(farmer));
        assertEq(rep.getAgentStats().verdicts, 0);
    }
}
