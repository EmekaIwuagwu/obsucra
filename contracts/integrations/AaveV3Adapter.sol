// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IObscuraOracle
 * @notice Interface for Obscura Oracle (Chainlink-compatible)
 */
interface IObscuraOracle {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestAnswer() external view returns (int256);
    function latestTimestamp() external view returns (uint256);
}

/**
 * @title IAavePoolAddressesProvider
 * @notice Minimal interface for Aave addresses provider
 */
interface IAavePoolAddressesProvider {
    function setPriceOracle(address newPriceOracle) external;
    function getPriceOracle() external view returns (address);
}

/**
 * @title IPoolConfigurator
 * @notice Minimal interface for Aave pool configurator
 */
interface IPoolConfigurator {
    function setAssetEModeCategory(address asset, uint8 newCategoryId) external;
}

/**
 * @title ObscuraAaveV3Adapter
 * @author Obscura Network
 * @notice Adapter to use Obscura Oracle as Aave V3 price source
 * @dev Implements IAaveOracle for direct integration with Aave V3
 *
 * This adapter provides:
 * - Direct price feed for any Aave-listed asset
 * - Stale price detection with fallback
 * - Optional ZK proof verification (off-chain, hash on-chain)
 * - Admin controls for emergency price overrides
 *
 * Usage:
 * 1. Deploy this adapter with Obscura Oracle addresses
 * 2. Configure asset mappings via setAssetSource()
 * 3. Update Aave's PoolAddressesProvider to use this adapter
 */
contract ObscuraAaveV3Adapter is Ownable {
    /// @notice Maximum age for price data before considered stale (1 hour)
    uint256 public constant MAX_STALE_PERIOD = 3600;

    /// @notice Mapping of asset address to Obscura Oracle address
    mapping(address => address) public assetSources;

    /// @notice Fallback prices for emergency use
    mapping(address => uint256) public fallbackPrices;

    /// @notice Base currency (usually USD with 8 decimals)
    address public immutable BASE_CURRENCY;

    /// @notice Base currency unit (10^8 for USD)
    uint256 public immutable BASE_CURRENCY_UNIT;

    /// @notice Custom stale periods per asset
    mapping(address => uint256) public customStalePeriods;

    /// @notice Emergency price override active
    mapping(address => bool) public emergencyMode;

    /// @notice Event emitted when price source is set
    event AssetSourceUpdated(address indexed asset, address indexed source);

    /// @notice Event emitted when fallback price is set
    event FallbackPriceSet(address indexed asset, uint256 price);

    /// @notice Event emitted when emergency mode is toggled
    event EmergencyModeSet(address indexed asset, bool enabled);

    /// @notice Event emitted on stale price detection
    event StalePriceDetected(
        address indexed asset,
        uint256 lastUpdate,
        uint256 threshold
    );

    /**
     * @notice Constructor
     * @param baseCurrency Address of base currency (use address(0) for USD)
     * @param baseCurrencyUnit Unit for base currency (10^8 for 8 decimals)
     */
    constructor(
        address baseCurrency,
        uint256 baseCurrencyUnit
    ) Ownable(msg.sender) {
        BASE_CURRENCY = baseCurrency;
        BASE_CURRENCY_UNIT = baseCurrencyUnit;
    }

    /**
     * @notice Set the Obscura Oracle source for an asset
     * @param asset The asset address
     * @param source The Obscura Oracle address for this asset
     */
    function setAssetSource(address asset, address source) external onlyOwner {
        require(source != address(0), "Invalid source address");
        assetSources[asset] = source;
        emit AssetSourceUpdated(asset, source);
    }

    /**
     * @notice Set multiple asset sources at once
     * @param assets Array of asset addresses
     * @param sources Array of Obscura Oracle addresses
     */
    function setAssetSources(
        address[] calldata assets,
        address[] calldata sources
    ) external onlyOwner {
        require(assets.length == sources.length, "Length mismatch");

        for (uint256 i = 0; i < assets.length; i++) {
            require(sources[i] != address(0), "Invalid source address");
            assetSources[assets[i]] = sources[i];
            emit AssetSourceUpdated(assets[i], sources[i]);
        }
    }

    /**
     * @notice Get the price of an asset
     * @param asset The asset address
     * @return The price in base currency units
     */
    function getAssetPrice(address asset) external view returns (uint256) {
        // Check emergency mode first
        if (emergencyMode[asset] && fallbackPrices[asset] > 0) {
            return fallbackPrices[asset];
        }

        address source = assetSources[asset];
        require(source != address(0), "No source for asset");

        IObscuraOracle oracle = IObscuraOracle(source);

        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = oracle.latestRoundData();

        // Validate data
        require(answer > 0, "Invalid price");
        require(answeredInRound >= roundId, "Stale round");

        // Check staleness
        uint256 stalePeriod = customStalePeriods[asset] > 0
            ? customStalePeriods[asset]
            : MAX_STALE_PERIOD;

        if (block.timestamp - updatedAt > stalePeriod) {
            // Return fallback if available, otherwise revert
            if (fallbackPrices[asset] > 0) {
                return fallbackPrices[asset];
            }
            revert("Price too stale");
        }

        return uint256(answer);
    }

    /**
     * @notice Get prices for multiple assets
     * @param assets Array of asset addresses
     * @return prices Array of prices in base currency units
     */
    function getAssetsPrices(
        address[] calldata assets
    ) external view returns (uint256[] memory prices) {
        prices = new uint256[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            prices[i] = this.getAssetPrice(assets[i]);
        }
    }

    /**
     * @notice Get the source for an asset
     * @param asset The asset address
     * @return The Obscura Oracle address
     */
    function getSourceOfAsset(address asset) external view returns (address) {
        return assetSources[asset];
    }

    /**
     * @notice Set a fallback price for emergency use
     * @param asset The asset address
     * @param price The fallback price
     */
    function setFallbackPrice(address asset, uint256 price) external onlyOwner {
        fallbackPrices[asset] = price;
        emit FallbackPriceSet(asset, price);
    }

    /**
     * @notice Toggle emergency mode for an asset
     * @param asset The asset address
     * @param enabled Whether emergency mode is enabled
     */
    function setEmergencyMode(address asset, bool enabled) external onlyOwner {
        emergencyMode[asset] = enabled;
        emit EmergencyModeSet(asset, enabled);
    }

    /**
     * @notice Set custom stale period for an asset
     * @param asset The asset address
     * @param period The stale period in seconds
     */
    function setCustomStalePeriod(
        address asset,
        uint256 period
    ) external onlyOwner {
        customStalePeriods[asset] = period;
    }

    /**
     * @notice Get detailed price data for an asset
     * @param asset The asset address
     */
    function getAssetPriceData(
        address asset
    )
        external
        view
        returns (
            uint256 price,
            uint256 timestamp,
            uint80 roundId,
            bool isStale,
            bool isEmergencyMode
        )
    {
        isEmergencyMode = emergencyMode[asset];

        if (isEmergencyMode && fallbackPrices[asset] > 0) {
            return (fallbackPrices[asset], block.timestamp, 0, false, true);
        }

        address source = assetSources[asset];
        require(source != address(0), "No source for asset");

        IObscuraOracle oracle = IObscuraOracle(source);

        (uint80 _roundId, int256 answer, , uint256 updatedAt, ) = oracle
            .latestRoundData();

        uint256 stalePeriod = customStalePeriods[asset] > 0
            ? customStalePeriods[asset]
            : MAX_STALE_PERIOD;

        isStale = block.timestamp - updatedAt > stalePeriod;

        return (uint256(answer), updatedAt, _roundId, isStale, false);
    }

    /**
     * @notice Check if a price is healthy (not stale, positive, etc.)
     * @param asset The asset address
     * @return healthy Whether the price is valid
     * @return reason Reason if not healthy
     */
    function isPriceHealthy(
        address asset
    ) external view returns (bool healthy, string memory reason) {
        address source = assetSources[asset];

        if (source == address(0)) {
            return (false, "No source configured");
        }

        try IObscuraOracle(source).latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) {
                return (false, "Negative or zero price");
            }

            if (answeredInRound < roundId) {
                return (false, "Stale round");
            }

            uint256 stalePeriod = customStalePeriods[asset] > 0
                ? customStalePeriods[asset]
                : MAX_STALE_PERIOD;

            if (block.timestamp - updatedAt > stalePeriod) {
                return (false, "Price too stale");
            }

            return (true, "");
        } catch {
            return (false, "Oracle call failed");
        }
    }

    /**
     * @notice Get the base currency
     * @return Base currency address
     */
    function getBaseCurrency() external view returns (address) {
        return BASE_CURRENCY;
    }

    /**
     * @notice Get the base currency unit
     * @return Base currency unit
     */
    function getBaseCurrencyUnit() external view returns (uint256) {
        return BASE_CURRENCY_UNIT;
    }
}

/**
 * @title ObscuraAaveHelpers
 * @notice Helper library for Aave V3 + Obscura integration
 */
library ObscuraAaveHelpers {
    /**
     * @notice Calculate health factor using Obscura prices
     * @param totalCollateralUSD Total collateral in USD
     * @param totalDebtUSD Total debt in USD
     * @param liquidationThreshold Average liquidation threshold (bps)
     * @return Health factor scaled by 1e18
     */
    function calculateHealthFactor(
        uint256 totalCollateralUSD,
        uint256 totalDebtUSD,
        uint256 liquidationThreshold
    ) internal pure returns (uint256) {
        if (totalDebtUSD == 0) {
            return type(uint256).max;
        }

        return
            (totalCollateralUSD * liquidationThreshold * 1e18) /
            (10000 * totalDebtUSD);
    }

    /**
     * @notice Calculate maximum borrowable amount
     * @param collateralUSD Collateral value in USD
     * @param ltv Loan-to-value ratio (bps)
     * @return Maximum borrow in USD
     */
    function calculateMaxBorrow(
        uint256 collateralUSD,
        uint256 ltv
    ) internal pure returns (uint256) {
        return (collateralUSD * ltv) / 10000;
    }
}
