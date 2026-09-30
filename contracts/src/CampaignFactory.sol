// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HarvestCampaign, CampaignParams} from "./HarvestCampaign.sol";
import {CampaignDeployer} from "./CampaignDeployer.sol";
import {IAgentIdentity} from "./interfaces/IAgentIdentity.sol";
import {IReputationBook, IReservePool} from "./interfaces/IBagiPanen.sol";

/// @notice Registri koperasi & petani, pembuat kampanye, dan konfigurasi agen.
/// `owner` adalah admin BagiPanen.
contract CampaignFactory is Ownable {
    uint16 public constant BPS = 10_000;
    uint256 public constant MAX_MILESTONES = 10;

    IERC20 public immutable usdt;
    CampaignDeployer public immutable deployer;
    IReputationBook public reputationBook;
    IReservePool public reservePool;

    mapping(address => bool) public isCooperative;
    mapping(address => string) public cooperativeName;
    mapping(address => address) public farmerCooperative;
    mapping(address => string) public farmerName;
    mapping(address => bool) public isCampaign;
    address[] public campaigns;
    mapping(address => address[]) private _campaignsByFarmer;

    address public identityRegistry;
    uint256 public agentId;
    address public agentWallet;

    event ModulesSet(address reputationBook, address reservePool);
    event CooperativeRegistered(address indexed cooperative, string name);
    event FarmerRegistered(address indexed farmer, address indexed cooperative, string name);
    event CampaignCreated(address campaign, address farmer);
    event CampaignApproved(address indexed campaign);
    event CampaignRejected(address indexed campaign);
    event AgentConfigured(address indexed identityRegistry, uint256 indexed agentId, address agentWallet);

    error ZeroAddress();
    error EmptyName();
    error AlreadyRegistered();
    error RoleConflict();
    error NotCooperative();
    error NotRegisteredFarmer();
    error FarmerBlocked();
    error ModulesNotSet();
    error ModulesAlreadySet();
    error NotCampaign();
    error InvalidParams();
    error AgentNotIndependent();
    error AgentNotOwner();

    constructor(IERC20 usdt_) Ownable(msg.sender) {
        if (address(usdt_) == address(0)) revert ZeroAddress();
        usdt = usdt_;
        deployer = new CampaignDeployer();
    }

    /// @notice Sekali pakai saat deploy: hubungkan ReputationBook & ReservePool.
    function setModules(IReputationBook reputationBook_, IReservePool reservePool_) external onlyOwner {
        if (address(reputationBook) != address(0)) revert ModulesAlreadySet();
        if (address(reputationBook_) == address(0) || address(reservePool_) == address(0)) revert ZeroAddress();
        reputationBook = reputationBook_;
        reservePool = reservePool_;
        emit ModulesSet(address(reputationBook_), address(reservePool_));
    }

    // ------------------------------------------------------------------
    // Onboarding
    // ------------------------------------------------------------------

    function registerCooperative(address coop, string calldata name) external onlyOwner {
        if (coop == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (isCooperative[coop]) revert AlreadyRegistered();
        if (_hasRole(coop)) revert RoleConflict();
        isCooperative[coop] = true;
        cooperativeName[coop] = name;
        emit CooperativeRegistered(coop, name);
    }

    function registerFarmer(address farmer, string calldata name) external {
        if (!isCooperative[msg.sender]) revert NotCooperative();
        if (farmer == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (farmerCooperative[farmer] != address(0)) revert AlreadyRegistered();
        if (_hasRole(farmer)) revert RoleConflict();
        farmerCooperative[farmer] = msg.sender;
        farmerName[farmer] = name;
        emit FarmerRegistered(farmer, msg.sender, name);
    }

    // ------------------------------------------------------------------
    // Kampanye
    // ------------------------------------------------------------------

    function createCampaign(CampaignParams calldata p) external returns (address) {
        address coop = farmerCooperative[msg.sender];
        if (coop == address(0)) revert NotRegisteredFarmer();
        if (address(reputationBook) == address(0)) revert ModulesNotSet();
        if (reputationBook.isBlocked(msg.sender)) revert FarmerBlocked();
        _validate(p);

        address addr = deployer.deploy(campaigns.length + 1, msg.sender, coop, p);
        isCampaign[addr] = true;
        campaigns.push(addr);
        _campaignsByFarmer[msg.sender].push(addr);
        emit CampaignCreated(addr, msg.sender);
        return addr;
    }

    function approveCampaign(address c) external onlyOwner {
        if (!isCampaign[c]) revert NotCampaign();
        HarvestCampaign(c).startFunding();
        emit CampaignApproved(c);
    }

    function rejectCampaign(address c) external onlyOwner {
        if (!isCampaign[c]) revert NotCampaign();
        HarvestCampaign(c).cancel();
        emit CampaignRejected(c);
    }

    // ------------------------------------------------------------------
    // Agen (ERC-8004)
    // ------------------------------------------------------------------

    /// @notice Konfigurasi agen verifikator. Wallet agen wajib independen
    /// (bukan admin, koperasi, atau petani) dan pemilik identitas `agentId_`.
    function setAgent(address identityRegistry_, uint256 agentId_, address agentWallet_) external onlyOwner {
        if (identityRegistry_ == address(0) || agentWallet_ == address(0)) revert ZeroAddress();
        if (agentWallet_ == owner() || isCooperative[agentWallet_] || farmerCooperative[agentWallet_] != address(0)) {
            revert AgentNotIndependent();
        }
        if (IAgentIdentity(identityRegistry_).ownerOf(agentId_) != agentWallet_) revert AgentNotOwner();
        identityRegistry = identityRegistry_;
        agentId = agentId_;
        agentWallet = agentWallet_;
        emit AgentConfigured(identityRegistry_, agentId_, agentWallet_);
    }

    function isAgent(address a) external view returns (bool) {
        if (a == address(0) || a != agentWallet) return false;
        try IAgentIdentity(identityRegistry).ownerOf(agentId) returns (address o) {
            return o == a;
        } catch {
            return false;
        }
    }

    // ------------------------------------------------------------------
    // View
    // ------------------------------------------------------------------

    function getCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    function getCampaignsByFarmer(address farmer) external view returns (address[] memory) {
        return _campaignsByFarmer[farmer];
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// @dev Satu wallet hanya memegang satu peran.
    function _hasRole(address a) private view returns (bool) {
        return a == owner() || a == agentWallet || isCooperative[a] || farmerCooperative[a] != address(0);
    }

    function _validate(CampaignParams calldata p) private view {
        uint256 n = p.milestoneNames.length;
        if (
            bytes(p.commodity).length == 0 || p.targetAmount == 0 || p.fundingDuration == 0
                || p.expectedHarvestDate <= block.timestamp || n == 0 || n > MAX_MILESTONES
                || n != p.milestoneBps.length
        ) revert InvalidParams();
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            if (p.milestoneBps[i] == 0) revert InvalidParams();
            sum += p.milestoneBps[i];
        }
        if (sum != BPS) revert InvalidParams();
    }
}
