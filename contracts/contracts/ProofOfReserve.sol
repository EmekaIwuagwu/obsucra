// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProofOfReserve
 * @notice Verifies and attests to off-chain collateral reserves
 * @dev Used by stablecoins, wrapped assets, and tokenized RWAs
 */
contract ProofOfReserve is Ownable, ReentrancyGuard {
    // Reserve status
    enum ReserveStatus {
        Unknown,
        Healthy,
        Warning,
        Critical,
        Paused
    }

    // Asset reserve information
    struct Reserve {
        string assetName; // e.g., "USDC", "wBTC"
        address tokenAddress; // On-chain token address
        string custodian; // e.g., "Circle", "BitGo"
        uint256 reportedReserve; // Off-chain reserve amount
        uint256 circulatingSupply; // On-chain circulating supply
        uint256 collateralRatio; // In basis points (10000 = 100%)
        uint256 lastUpdateTime;
        uint256 updateFrequency; // How often updates are required
        bytes32 proofHash; // Hash of the attestation proof
        ReserveStatus status;
        bool active;
    }

    // Attestation record
    struct Attestation {
        address auditor;
        uint256 timestamp;
        uint256 reportedReserve;
        uint256 verifiedReserve;
        bytes32 proofHash;
        string reportURI; // IPFS or URL to full report
        bool isValid;
    }

    // State
    mapping(bytes32 => Reserve) public reserves; // assetId => Reserve
    mapping(bytes32 => Attestation[]) public attestations; // assetId => history
    mapping(address => bool) public authorizedAuditors;
    bytes32[] public assetList;

    // Thresholds
    uint256 public healthyThreshold = 10000; // 100% collateral
    uint256 public warningThreshold = 9500; // 95% collateral
    uint256 public criticalThreshold = 9000; // 90% collateral

    // Events
    event ReserveRegistered(
        bytes32 indexed assetId,
        string assetName,
        address tokenAddress
    );
    event ReserveUpdated(
        bytes32 indexed assetId,
        uint256 reportedReserve,
        uint256 circulatingSupply,
        uint256 ratio
    );
    event AttestationSubmitted(
        bytes32 indexed assetId,
        address indexed auditor,
        uint256 verifiedReserve
    );
    event ReserveStatusChanged(
        bytes32 indexed assetId,
        ReserveStatus oldStatus,
        ReserveStatus newStatus
    );
    event AuditorAuthorized(address indexed auditor);
    event AuditorRevoked(address indexed auditor);
    event ReservePaused(bytes32 indexed assetId, string reason);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ============ RESERVE MANAGEMENT ============

    /**
     * @notice Register a new asset for reserve tracking
     */
    function registerReserve(
        string calldata assetName,
        address tokenAddress,
        string calldata custodian,
        uint256 updateFrequency
    ) external onlyOwner returns (bytes32 assetId) {
        assetId = keccak256(abi.encodePacked(assetName, tokenAddress));
        require(
            reserves[assetId].tokenAddress == address(0),
            "Already registered"
        );

        reserves[assetId] = Reserve({
            assetName: assetName,
            tokenAddress: tokenAddress,
            custodian: custodian,
            reportedReserve: 0,
            circulatingSupply: 0,
            collateralRatio: 0,
            lastUpdateTime: 0,
            updateFrequency: updateFrequency,
            proofHash: bytes32(0),
            status: ReserveStatus.Unknown,
            active: true
        });

        assetList.push(assetId);

        emit ReserveRegistered(assetId, assetName, tokenAddress);
        return assetId;
    }

    /**
     * @notice Update reserve data (called by authorized auditors or oracle)
     */
    function updateReserve(
        bytes32 assetId,
        uint256 reportedReserve,
        uint256 circulatingSupply,
        bytes32 proofHash
    ) external {
        require(
            authorizedAuditors[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        Reserve storage reserve = reserves[assetId];
        require(reserve.active, "Reserve not active");

        reserve.reportedReserve = reportedReserve;
        reserve.circulatingSupply = circulatingSupply;
        reserve.proofHash = proofHash;
        reserve.lastUpdateTime = block.timestamp;

        // Calculate collateral ratio
        if (circulatingSupply > 0) {
            reserve.collateralRatio =
                (reportedReserve * 10000) /
                circulatingSupply;
        } else {
            reserve.collateralRatio = 10000; // 100% if no supply
        }

        // Update status
        ReserveStatus oldStatus = reserve.status;
        reserve.status = _calculateStatus(reserve.collateralRatio);

        if (oldStatus != reserve.status) {
            emit ReserveStatusChanged(assetId, oldStatus, reserve.status);
        }

        emit ReserveUpdated(
            assetId,
            reportedReserve,
            circulatingSupply,
            reserve.collateralRatio
        );
    }

    /**
     * @notice Submit an attestation from an authorized auditor
     */
    function submitAttestation(
        bytes32 assetId,
        uint256 verifiedReserve,
        bytes32 proofHash,
        string calldata reportURI
    ) external {
        require(authorizedAuditors[msg.sender], "Not an authorized auditor");
        Reserve storage reserve = reserves[assetId];
        require(reserve.active, "Reserve not active");

        Attestation memory attestation = Attestation({
            auditor: msg.sender,
            timestamp: block.timestamp,
            reportedReserve: reserve.reportedReserve,
            verifiedReserve: verifiedReserve,
            proofHash: proofHash,
            reportURI: reportURI,
            isValid: verifiedReserve >= (reserve.reportedReserve * 99) / 100 // Within 1%
        });

        attestations[assetId].push(attestation);

        // Update reserve with verified data
        reserve.reportedReserve = verifiedReserve;
        reserve.proofHash = proofHash;
        reserve.lastUpdateTime = block.timestamp;

        emit AttestationSubmitted(assetId, msg.sender, verifiedReserve);
    }

    /**
     * @notice Pause a reserve due to issues
     */
    function pauseReserve(
        bytes32 assetId,
        string calldata reason
    ) external onlyOwner {
        reserves[assetId].status = ReserveStatus.Paused;
        reserves[assetId].active = false;
        emit ReservePaused(assetId, reason);
    }

    /**
     * @notice Reactivate a paused reserve
     */
    function reactivateReserve(bytes32 assetId) external onlyOwner {
        reserves[assetId].active = true;
        reserves[assetId].status = _calculateStatus(
            reserves[assetId].collateralRatio
        );
    }

    // ============ AUDITOR MANAGEMENT ============

    function authorizeAuditor(address auditor) external onlyOwner {
        authorizedAuditors[auditor] = true;
        emit AuditorAuthorized(auditor);
    }

    function revokeAuditor(address auditor) external onlyOwner {
        authorizedAuditors[auditor] = false;
        emit AuditorRevoked(auditor);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Check if a reserve is healthy (100%+ collateralized)
     */
    function isHealthy(bytes32 assetId) external view returns (bool) {
        return reserves[assetId].status == ReserveStatus.Healthy;
    }

    /**
     * @notice Check if reserve data is stale
     */
    function isStale(bytes32 assetId) external view returns (bool) {
        Reserve storage reserve = reserves[assetId];
        return
            block.timestamp > reserve.lastUpdateTime + reserve.updateFrequency;
    }

    /**
     * @notice Get current collateral ratio
     */
    function getCollateralRatio(
        bytes32 assetId
    ) external view returns (uint256) {
        return reserves[assetId].collateralRatio;
    }

    /**
     * @notice Get reserve details
     */
    function getReserveInfo(
        bytes32 assetId
    )
        external
        view
        returns (
            string memory assetName,
            address tokenAddress,
            string memory custodian,
            uint256 reportedReserve,
            uint256 circulatingSupply,
            uint256 collateralRatio,
            uint256 lastUpdateTime,
            ReserveStatus status
        )
    {
        Reserve storage reserve = reserves[assetId];
        return (
            reserve.assetName,
            reserve.tokenAddress,
            reserve.custodian,
            reserve.reportedReserve,
            reserve.circulatingSupply,
            reserve.collateralRatio,
            reserve.lastUpdateTime,
            reserve.status
        );
    }

    /**
     * @notice Get attestation history for an asset
     */
    function getAttestations(
        bytes32 assetId
    ) external view returns (Attestation[] memory) {
        return attestations[assetId];
    }

    /**
     * @notice Get latest attestation
     */
    function getLatestAttestation(
        bytes32 assetId
    )
        external
        view
        returns (
            address auditor,
            uint256 timestamp,
            uint256 verifiedReserve,
            bool isValid
        )
    {
        Attestation[] storage history = attestations[assetId];
        require(history.length > 0, "No attestations");

        Attestation storage latest = history[history.length - 1];
        return (
            latest.auditor,
            latest.timestamp,
            latest.verifiedReserve,
            latest.isValid
        );
    }

    /**
     * @notice Get all registered assets
     */
    function getAllAssets() external view returns (bytes32[] memory) {
        return assetList;
    }

    /**
     * @notice Get aggregate reserve health across all assets
     */
    function getAggregateHealth()
        external
        view
        returns (
            uint256 totalReserves,
            uint256 totalSupply,
            uint256 avgCollateralRatio,
            uint256 healthyCount,
            uint256 warningCount,
            uint256 criticalCount
        )
    {
        for (uint256 i = 0; i < assetList.length; i++) {
            Reserve storage reserve = reserves[assetList[i]];
            if (reserve.active) {
                totalReserves += reserve.reportedReserve;
                totalSupply += reserve.circulatingSupply;

                if (reserve.status == ReserveStatus.Healthy) healthyCount++;
                else if (reserve.status == ReserveStatus.Warning)
                    warningCount++;
                else if (reserve.status == ReserveStatus.Critical)
                    criticalCount++;
            }
        }

        if (totalSupply > 0) {
            avgCollateralRatio = (totalReserves * 10000) / totalSupply;
        }
    }

    // ============ INTERNAL FUNCTIONS ============

    function _calculateStatus(
        uint256 ratio
    ) internal view returns (ReserveStatus) {
        if (ratio >= healthyThreshold) return ReserveStatus.Healthy;
        if (ratio >= warningThreshold) return ReserveStatus.Warning;
        if (ratio >= criticalThreshold) return ReserveStatus.Critical;
        return ReserveStatus.Critical;
    }

    // ============ CONFIG ============

    function setThresholds(
        uint256 _healthy,
        uint256 _warning,
        uint256 _critical
    ) external onlyOwner {
        healthyThreshold = _healthy;
        warningThreshold = _warning;
        criticalThreshold = _critical;
    }
}
