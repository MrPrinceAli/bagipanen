// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ICampaignFactory, IReputationBook, IReservePool} from "./interfaces/IBagiPanen.sol";

/// @notice Parameter pengajuan kampanye oleh petani.
struct CampaignParams {
    string commodity; // "Cabai merah"
    string locationName; // "Cikajang, Garut"
    int32 latE6; // lintang x 1e6
    int32 lonE6; // bujur x 1e6
    uint32 landAreaM2; // 5000
    uint256 targetAmount; // 1000e18
    uint256 estimatedRevenue; // 1650e18
    uint64 fundingDuration; // detik; demo 600
    uint64 expectedHarvestDate; // unix time
    string metadataCID; // JSON kampanye di IPFS
    string[] milestoneNames; // ["Tanam","Tumbuh","Pra-panen"]
    uint16[] milestoneBps; // [4000,3500,2500]
}

/// @notice Satu kampanye pendanaan panen: escrow, token porsi (tidak bisa
/// ditransfer), milestone dengan dua kunci (agen AI + koperasi), dan bagi hasil.
contract HarvestCampaign is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Draft,
        Funding,
        Active,
        Harvested,
        Failed,
        Cancelled,
        Defaulted
    }

    enum FailType {
        None,
        Funding,
        Crop
    }

    enum MStatus {
        Pending,
        ProofSubmitted,
        AIReviewed,
        Rejected,
        Disputed,
        Released
    }

    struct Milestone {
        string name;
        uint16 bps;
        MStatus status;
        uint8 attempts;
        string proofCID;
        bool aiDecided;
        bool aiApproved;
        string aiReasonCID;
        bool verifierDecided;
        bool verifierApproved;
        uint256 releasedAmount;
        uint64 submittedAt;
    }

    /// @notice Ringkasan kampanye untuk UI dan agen (satu panggilan).
    struct Summary {
        uint256 campaignId;
        address farmer;
        address cooperative;
        Status status;
        FailType failType;
        string commodity;
        string locationName;
        int32 latE6;
        int32 lonE6;
        uint32 landAreaM2;
        uint256 targetAmount;
        uint256 estimatedRevenue;
        uint256 raisedAmount;
        uint64 fundingDeadline;
        uint64 expectedHarvestDate;
        string metadataCID;
        uint8 currentMilestone;
        uint8 milestoneCount;
        uint256 totalReleased;
        uint256 harvestAmount;
        string receiptCID;
        uint256 investorPool;
        uint256 totalSharesAtSettle;
    }

    /// @notice Salinan CampaignParams tanpa array milestone (nama & bobot disimpan di `milestones`).
    struct Terms {
        string commodity;
        string locationName;
        int32 latE6;
        int32 lonE6;
        uint32 landAreaM2;
        uint256 targetAmount;
        uint256 estimatedRevenue;
        uint64 fundingDuration;
        uint64 expectedHarvestDate;
        string metadataCID;
    }

    uint16 public constant BPS = 10_000;
    uint16 public constant FARMER_PROFIT_BPS = 5_500; // 55%
    uint16 public constant INVESTOR_PROFIT_BPS = 4_000; // 40% (diterima investor sebagai sisa pembagian)
    uint16 public constant RESERVE_PROFIT_BPS = 500; // 5%
    uint8 public constant MAX_ATTEMPTS = 3;
    uint64 public constant DEFAULT_GRACE = 30 days;
    uint64 public constant ON_TIME_WINDOW = 7 days;

    address public immutable factory;
    address public immutable farmer;
    address public immutable cooperative;
    IERC20 public immutable usdt;
    IReputationBook public immutable reputationBook;
    IReservePool public immutable reservePool;
    uint256 public immutable campaignId;

    Terms internal params;
    Status public status;
    FailType public failType;
    uint64 public fundingDeadline;
    uint256 public raisedAmount;
    uint8 public currentMilestone;
    Milestone[] internal milestones;
    uint256 public totalReleased;
    uint256 public harvestAmount;
    string public receiptCID;
    uint256 public investorPool;
    uint256 public totalSharesAtSettle;
    mapping(address => uint256) public paidOut;

    event Funded(address indexed investor, uint256 amount);
    event FundingSucceeded(uint256 raisedAmount);
    event FundingFailed(uint256 raisedAmount);
    event Refunded(address indexed investor, uint256 amount);
    event ProofSubmitted(uint8 index, string cid, uint8 attempt);
    event VerdictRecorded(uint8 index, bool approved, string reasonCID);
    event VerifierDecided(uint8 index, bool approved);
    event MilestoneRejected(uint8 index);
    event MilestoneDisputed(uint8 index);
    event DisputeResolved(uint8 index, bool approved);
    event TrancheReleased(uint8 index, uint256 amount);
    event HarvestDeposited(uint256 amount, string receiptCID);
    event Claimed(address indexed investor, uint256 amount);
    event CampaignFailed(uint256 investorPool);
    event CampaignDefaulted(uint256 investorPool);
    event CompensationAdded(uint256 amount);

    error NotFactory();
    error NotFarmer();
    error NotCooperative();
    error NotAgent();
    error NotAdmin();
    error NotReservePool();
    error InvalidStatus();
    error InvalidMilestoneStatus();
    error NoMilestoneLeft();
    error MilestonesIncomplete();
    error FundingClosed();
    error FundingStillOpen();
    error NotAllowedToFund();
    error ExceedsTarget();
    error ZeroAmount();
    error EmptyCID();
    error TooManyAttempts();
    error NothingToRefund();
    error NothingToClaim();
    error GracePeriodActive();
    error NonTransferable();

    /// @dev Di-deploy oleh CampaignDeployer atas perintah factory; modul dibaca dari factory.
    constructor(address factory_, uint256 campaignId_, address farmer_, address cooperative_, CampaignParams memory p)
        ERC20("BagiPanen Share", string.concat("BPS-", Strings.toString(campaignId_)))
    {
        factory = factory_;
        campaignId = campaignId_;
        farmer = farmer_;
        cooperative = cooperative_;
        usdt = IERC20(ICampaignFactory(factory_).usdt());
        reputationBook = IReputationBook(ICampaignFactory(factory_).reputationBook());
        reservePool = IReservePool(ICampaignFactory(factory_).reservePool());
        params = Terms({
            commodity: p.commodity,
            locationName: p.locationName,
            latE6: p.latE6,
            lonE6: p.lonE6,
            landAreaM2: p.landAreaM2,
            targetAmount: p.targetAmount,
            estimatedRevenue: p.estimatedRevenue,
            fundingDuration: p.fundingDuration,
            expectedHarvestDate: p.expectedHarvestDate,
            metadataCID: p.metadataCID
        });
        for (uint256 i; i < p.milestoneNames.length; ++i) {
            Milestone storage m = milestones.push();
            m.name = p.milestoneNames[i];
            m.bps = p.milestoneBps[i];
        }
    }

    // ------------------------------------------------------------------
    // Fase 2 — persetujuan (hanya lewat factory)
    // ------------------------------------------------------------------

    function startFunding() external {
        if (msg.sender != factory) revert NotFactory();
        if (status != Status.Draft) revert InvalidStatus();
        status = Status.Funding;
        fundingDeadline = uint64(block.timestamp) + params.fundingDuration;
    }

    function cancel() external {
        if (msg.sender != factory) revert NotFactory();
        if (status != Status.Draft) revert InvalidStatus();
        status = Status.Cancelled;
    }

    // ------------------------------------------------------------------
    // Fase 3 — pendanaan
    // ------------------------------------------------------------------

    function fund(uint256 amount) external nonReentrant {
        if (status != Status.Funding) revert InvalidStatus();
        if (block.timestamp > fundingDeadline) revert FundingClosed();
        if (msg.sender == farmer || msg.sender == cooperative) revert NotAllowedToFund();
        if (amount == 0) revert ZeroAmount();
        if (amount > params.targetAmount - raisedAmount) revert ExceedsTarget();

        raisedAmount += amount;
        _mint(msg.sender, amount);
        bool full = raisedAmount == params.targetAmount;
        if (full) status = Status.Active;

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
        if (full) {
            reputationBook.recordFunded(farmer);
            emit FundingSucceeded(raisedAmount);
        }
    }

    function finalizeFunding() external {
        if (status != Status.Funding) revert InvalidStatus();
        if (block.timestamp <= fundingDeadline) revert FundingStillOpen();
        status = Status.Failed;
        failType = FailType.Funding;
        emit FundingFailed(raisedAmount);
    }

    function refund() external nonReentrant {
        if (status != Status.Failed || failType != FailType.Funding) revert InvalidStatus();
        uint256 amount = balanceOf(msg.sender);
        if (amount == 0) revert NothingToRefund();
        _burn(msg.sender, amount);
        usdt.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Fase 4 — milestone & pencairan dua kunci
    // ------------------------------------------------------------------

    function submitProof(string calldata cid) external {
        if (msg.sender != farmer) revert NotFarmer();
        (Milestone storage m, uint8 idx) = _activeMilestone();
        if (bytes(cid).length == 0) revert EmptyCID();
        if (m.status != MStatus.Pending && m.status != MStatus.Rejected) revert InvalidMilestoneStatus();
        if (m.attempts >= MAX_ATTEMPTS) revert TooManyAttempts();

        m.status = MStatus.ProofSubmitted;
        m.proofCID = cid;
        m.aiDecided = false;
        m.aiApproved = false;
        m.aiReasonCID = "";
        m.verifierDecided = false;
        m.verifierApproved = false;
        m.attempts += 1;
        m.submittedAt = uint64(block.timestamp);
        emit ProofSubmitted(idx, cid, m.attempts);
    }

    function recordVerdict(bool ok, string calldata reasonCID) external nonReentrant {
        if (!ICampaignFactory(factory).isAgent(msg.sender)) revert NotAgent();
        (Milestone storage m, uint8 idx) = _activeMilestone();
        if (m.status != MStatus.ProofSubmitted) revert InvalidMilestoneStatus();
        if (bytes(reasonCID).length == 0) revert EmptyCID();

        m.aiDecided = true;
        m.aiApproved = ok;
        m.aiReasonCID = reasonCID;
        m.status = MStatus.AIReviewed;
        reputationBook.recordVerdict(ok);
        emit VerdictRecorded(idx, ok, reasonCID);
        _tryResolve(m, idx);
    }

    function verifierDecision(bool ok) external nonReentrant {
        if (msg.sender != cooperative) revert NotCooperative();
        (Milestone storage m, uint8 idx) = _activeMilestone();
        if (m.status != MStatus.ProofSubmitted && m.status != MStatus.AIReviewed) revert InvalidMilestoneStatus();
        if (m.verifierDecided) revert InvalidMilestoneStatus();

        m.verifierDecided = true;
        m.verifierApproved = ok;
        emit VerifierDecided(idx, ok);
        _tryResolve(m, idx);
    }

    /// @notice Admin memutuskan milestone yang ditolak 3 kali.
    /// ok = true → dana tahap cair; ok = false → ditolak final (admin bisa markFailed).
    function resolveDispute(bool ok) external nonReentrant {
        _onlyAdmin();
        (Milestone storage m, uint8 idx) = _activeMilestone();
        if (m.status != MStatus.Disputed) revert InvalidMilestoneStatus();

        if (ok != m.aiApproved) reputationBook.recordOverturn();
        emit DisputeResolved(idx, ok);
        if (ok) {
            _release(m, idx);
        } else {
            m.status = MStatus.Rejected; // attempts == MAX_ATTEMPTS, jadi tidak bisa diajukan ulang
            emit MilestoneRejected(idx);
        }
    }

    // ------------------------------------------------------------------
    // Fase 5 — panen, gagal panen, default, klaim
    // ------------------------------------------------------------------

    function depositHarvest(uint256 amount, string calldata cid) external nonReentrant {
        if (msg.sender != farmer) revert NotFarmer();
        if (status != Status.Active) revert InvalidStatus();
        if (currentMilestone < milestones.length) revert MilestonesIncomplete();
        if (amount == 0) revert ZeroAmount();
        if (bytes(cid).length == 0) revert EmptyCID();

        uint256 farmerShare;
        uint256 reserveShare;
        if (amount >= raisedAmount) {
            uint256 profit = amount - raisedAmount;
            farmerShare = profit * FARMER_PROFIT_BPS / BPS;
            reserveShare = profit * RESERVE_PROFIT_BPS / BPS;
        }
        status = Status.Harvested;
        harvestAmount = amount;
        receiptCID = cid;
        investorPool = amount - farmerShare - reserveShare;
        totalSharesAtSettle = totalSupply();
        bool onTime = block.timestamp <= params.expectedHarvestDate + ON_TIME_WINDOW;

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        if (farmerShare > 0) usdt.safeTransfer(farmer, farmerShare);
        if (reserveShare > 0) {
            usdt.safeTransfer(address(reservePool), reserveShare);
            reservePool.contribute(reserveShare);
        }
        reputationBook.recordHarvest(farmer, amount, params.estimatedRevenue, onTime);
        emit HarvestDeposited(amount, cid);
    }

    /// @notice Admin menandai gagal panen; sisa escrow menjadi pool investor.
    function markFailed() external {
        _onlyAdmin();
        if (status != Status.Active) revert InvalidStatus();
        status = Status.Failed;
        failType = FailType.Crop;
        _settleRemaining();
        reputationBook.recordCropFailure(farmer);
        emit CampaignFailed(investorPool);
    }

    /// @notice Admin menandai petani gagal bayar setelah perkiraan panen + 30 hari.
    function markDefault() external {
        _onlyAdmin();
        if (status != Status.Active) revert InvalidStatus();
        if (block.timestamp <= params.expectedHarvestDate + DEFAULT_GRACE) revert GracePeriodActive();
        status = Status.Defaulted;
        _settleRemaining();
        reputationBook.recordDefault(farmer);
        emit CampaignDefaulted(investorPool);
    }

    /// @notice Dipanggil ReservePool setelah mentransfer kompensasi ke kontrak ini.
    function addCompensation(uint256 amount) external {
        if (msg.sender != address(reservePool)) revert NotReservePool();
        if (!_isSettledFailure()) revert InvalidStatus();
        investorPool += amount;
        emit CompensationAdded(amount);
    }

    /// @notice Klaim kumulatif: kompensasi yang masuk belakangan tetap bisa diklaim.
    function claim() external nonReentrant {
        if (!_isClaimable()) revert InvalidStatus();
        uint256 pay = claimable(msg.sender);
        if (pay == 0) revert NothingToClaim();
        paidOut[msg.sender] += pay;
        usdt.safeTransfer(msg.sender, pay);
        emit Claimed(msg.sender, pay);
    }

    // ------------------------------------------------------------------
    // View
    // ------------------------------------------------------------------

    function claimable(address investor) public view returns (uint256) {
        if (!_isClaimable()) return 0;
        uint256 owed = investorPool * balanceOf(investor) / totalSharesAtSettle;
        return owed - paidOut[investor];
    }

    function getSummary() external view returns (Summary memory s) {
        Terms storage p = params;
        s.campaignId = campaignId;
        s.farmer = farmer;
        s.cooperative = cooperative;
        s.status = status;
        s.failType = failType;
        s.commodity = p.commodity;
        s.locationName = p.locationName;
        s.latE6 = p.latE6;
        s.lonE6 = p.lonE6;
        s.landAreaM2 = p.landAreaM2;
        s.targetAmount = p.targetAmount;
        s.estimatedRevenue = p.estimatedRevenue;
        s.raisedAmount = raisedAmount;
        s.fundingDeadline = fundingDeadline;
        s.expectedHarvestDate = p.expectedHarvestDate;
        s.metadataCID = p.metadataCID;
        s.currentMilestone = currentMilestone;
        s.milestoneCount = uint8(milestones.length);
        s.totalReleased = totalReleased;
        s.harvestAmount = harvestAmount;
        s.receiptCID = receiptCID;
        s.investorPool = investorPool;
        s.totalSharesAtSettle = totalSharesAtSettle;
    }

    function getMilestones() external view returns (Milestone[] memory) {
        return milestones;
    }

    // ------------------------------------------------------------------
    // Token porsi tidak bisa dipindahtangankan (MVP)
    // ------------------------------------------------------------------

    function transfer(address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert NonTransferable();
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _tryResolve(Milestone storage m, uint8 idx) private {
        if (!m.aiDecided || !m.verifierDecided) return;
        if (m.aiApproved && m.verifierApproved) {
            _release(m, idx);
        } else if (m.attempts >= MAX_ATTEMPTS) {
            m.status = MStatus.Disputed;
            emit MilestoneDisputed(idx);
        } else {
            m.status = MStatus.Rejected;
            emit MilestoneRejected(idx);
        }
    }

    function _release(Milestone storage m, uint8 idx) private {
        // Milestone terakhir mencairkan sisa escrow agar tidak ada debu pembulatan.
        uint256 amount = idx == milestones.length - 1 ? raisedAmount - totalReleased : raisedAmount * m.bps / BPS;
        m.status = MStatus.Released;
        m.releasedAmount = amount;
        totalReleased += amount;
        currentMilestone = idx + 1;
        usdt.safeTransfer(farmer, amount);
        emit TrancheReleased(idx, amount);
    }

    function _settleRemaining() private {
        investorPool = usdt.balanceOf(address(this));
        totalSharesAtSettle = totalSupply();
    }

    function _activeMilestone() private view returns (Milestone storage m, uint8 idx) {
        if (status != Status.Active) revert InvalidStatus();
        idx = currentMilestone;
        if (idx >= milestones.length) revert NoMilestoneLeft();
        m = milestones[idx];
    }

    function _onlyAdmin() private view {
        if (msg.sender != ICampaignFactory(factory).owner()) revert NotAdmin();
    }

    function _isSettledFailure() private view returns (bool) {
        return (status == Status.Failed && failType == FailType.Crop) || status == Status.Defaulted;
    }

    function _isClaimable() private view returns (bool) {
        return status == Status.Harvested || _isSettledFailure();
    }
}
