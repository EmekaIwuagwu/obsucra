package chains

import (
	"context"
	"math/big"
	"time"
)

// RoundData represents oracle round data compatible with Chainlink interface
type RoundData struct {
	RoundID         uint64
	Answer          *big.Int
	StartedAt       time.Time
	UpdatedAt       time.Time
	AnsweredInRound uint64
	Decimals        uint8
	Description     string
}

// TransactionReceipt represents a cross-chain transaction receipt
type TransactionReceipt struct {
	TxHash      string
	BlockNumber uint64
	GasUsed     uint64
	Status      bool
	Logs        []EventLog
}

// EventLog represents a blockchain event
type EventLog struct {
	Address string
	Topics  []string
	Data    []byte
}

// ChainConfig holds configuration for a blockchain
type ChainConfig struct {
	Name              string
	ChainID           uint64
	RPCURL            string
	WebSocketURL      string
	ExplorerURL       string
	NativeToken       string
	OracleContract    string
	StakeGuardContract string
	VerifierContract  string
	ConfirmationBlocks uint64
	GasStrategy       GasStrategy
	IsEnabled         bool
}

// GasStrategy defines gas pricing strategy for a chain
type GasStrategy string

const (
	GasStrategyLegacy   GasStrategy = "legacy"
	GasStrategyEIP1559  GasStrategy = "eip1559"
	GasStrategySolana   GasStrategy = "solana_cu"
	GasStrategyL2Compressed GasStrategy = "l2_compressed"
)

// ChainAdapter is the interface that all chain implementations must satisfy
type ChainAdapter interface {
	// Core identification
	Name() string
	ChainID() uint64
	ChainType() ChainType
	
	// Connection management
	Connect(ctx context.Context) error
	Disconnect() error
	IsConnected() bool
	HealthCheck(ctx context.Context) error
	
	// Oracle operations
	SubmitOracleUpdate(ctx context.Context, params OracleUpdateParams) (*TransactionReceipt, error)
	GetLatestRoundData(ctx context.Context, feedID string) (*RoundData, error)
	GetRoundData(ctx context.Context, feedID string, roundID uint64) (*RoundData, error)
	
	// VRF operations
	SubmitVRFResult(ctx context.Context, requestID string, randomness *big.Int, proof []byte) (*TransactionReceipt, error)
	
	// Gas estimation
	EstimateGas(ctx context.Context, feed string, value *big.Int) (uint64, error)
	GetGasPrice(ctx context.Context) (*GasPriceInfo, error)
	
	// Event subscription
	SubscribeOracleRequests(ctx context.Context, callback OracleRequestCallback) error
	SubscribeVRFRequests(ctx context.Context, callback VRFRequestCallback) error
	
	// Contract deployment (for admin operations)
	DeployContracts(ctx context.Context, bytecode []byte, constructorArgs []interface{}) (string, error)
}

// ChainType identifies the blockchain family
type ChainType string

const (
	ChainTypeEVM    ChainType = "evm"
	ChainTypeSolana ChainType = "solana"
	ChainTypeCosmos ChainType = "cosmos"
)

// OracleUpdateParams contains parameters for an oracle update
type OracleUpdateParams struct {
	FeedID       string
	Value        *big.Int
	Min          *big.Int
	Max          *big.Int
	Timestamp    time.Time
	ZKProof      []byte
	PublicInputs [2]*big.Int
	RequestID    uint64
	IsOptimistic bool
	OEVBid       *big.Int
}

// GasPriceInfo contains gas pricing information
type GasPriceInfo struct {
	// Legacy
	GasPrice *big.Int
	
	// EIP-1559
	BaseFee      *big.Int
	MaxFeePerGas *big.Int
	MaxPriorityFee *big.Int
	
	// Solana
	ComputeUnits   uint64
	PriorityFee    uint64
	
	// Additional info
	EstimatedUSD   float64
	Congestion     float64 // 0.0 - 1.0
}

// OracleRequestCallback is called when a new oracle request is detected
type OracleRequestCallback func(request *OracleRequest)

// VRFRequestCallback is called when a new VRF request is detected
type VRFRequestCallback func(request *VRFRequest)

// OracleRequest represents an incoming oracle data request
type OracleRequest struct {
	RequestID       uint64
	ChainID         uint64
	APIURL          string
	MinThreshold    *big.Int
	MaxThreshold    *big.Int
	Requester       string
	OEVEnabled      bool
	OEVBeneficiary  string
	IsOptimistic    bool
	Metadata        string
	Timestamp       time.Time
	BlockNumber     uint64
	TxHash          string
}

// VRFRequest represents a randomness request
type VRFRequest struct {
	RequestID   uint64
	ChainID     uint64
	Seed        string
	Requester   string
	NumWords    uint32
	CallbackGas uint64
	Timestamp   time.Time
	BlockNumber uint64
	TxHash      string
}

// MultiChainManager coordinates operations across multiple chains
type MultiChainManager struct {
	adapters map[uint64]ChainAdapter
	configs  map[uint64]*ChainConfig
	primary  uint64 // Primary chain ID for coordination
}

// NewMultiChainManager creates a new multi-chain manager
func NewMultiChainManager() *MultiChainManager {
	return &MultiChainManager{
		adapters: make(map[uint64]ChainAdapter),
		configs:  make(map[uint64]*ChainConfig),
		primary:  1, // Ethereum mainnet by default
	}
}

// RegisterChain adds a new chain to the manager
func (m *MultiChainManager) RegisterChain(config *ChainConfig, adapter ChainAdapter) error {
	m.configs[config.ChainID] = config
	m.adapters[config.ChainID] = adapter
	return nil
}

// GetAdapter returns the adapter for a specific chain
func (m *MultiChainManager) GetAdapter(chainID uint64) (ChainAdapter, bool) {
	adapter, ok := m.adapters[chainID]
	return adapter, ok
}

// GetAllChains returns all registered chain IDs
func (m *MultiChainManager) GetAllChains() []uint64 {
	chains := make([]uint64, 0, len(m.adapters))
	for chainID := range m.adapters {
		chains = append(chains, chainID)
	}
	return chains
}

// BroadcastOracleUpdate sends the same update to multiple chains
func (m *MultiChainManager) BroadcastOracleUpdate(ctx context.Context, params OracleUpdateParams, targetChains []uint64) map[uint64]*TransactionReceipt {
	results := make(map[uint64]*TransactionReceipt)
	
	for _, chainID := range targetChains {
		if adapter, ok := m.adapters[chainID]; ok {
			receipt, err := adapter.SubmitOracleUpdate(ctx, params)
			if err == nil {
				results[chainID] = receipt
			}
		}
	}
	
	return results
}

// Supported EVM Chain IDs
const (
	ChainIDEthereum      uint64 = 1
	ChainIDOptimism      uint64 = 10
	ChainIDBNBChain      uint64 = 56
	ChainIDPolygon       uint64 = 137
	ChainIDArbitrum      uint64 = 42161
	ChainIDAvalanche     uint64 = 43114
	ChainIDBase          uint64 = 8453
	ChainIDZkSyncEra     uint64 = 324
	ChainIDLinea         uint64 = 59144
	ChainIDScroll        uint64 = 534352
	ChainIDMantle        uint64 = 5000
	
	// Testnets
	ChainIDSepolia         uint64 = 11155111
	ChainIDBaseSepolia     uint64 = 84532
	ChainIDArbitrumSepolia uint64 = 421614
	ChainIDOptimismSepolia uint64 = 11155420
)

// GetDefaultChainConfigs returns default configurations for supported chains
func GetDefaultChainConfigs() []*ChainConfig {
	return []*ChainConfig{
		{
			Name:               "Ethereum",
			ChainID:            ChainIDEthereum,
			NativeToken:        "ETH",
			ConfirmationBlocks: 12,
			GasStrategy:        GasStrategyEIP1559,
			IsEnabled:          true,
		},
		{
			Name:               "Arbitrum",
			ChainID:            ChainIDArbitrum,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Base",
			ChainID:            ChainIDBase,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Optimism",
			ChainID:            ChainIDOptimism,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Polygon",
			ChainID:            ChainIDPolygon,
			NativeToken:        "MATIC",
			ConfirmationBlocks: 128,
			GasStrategy:        GasStrategyEIP1559,
			IsEnabled:          true,
		},
		{
			Name:               "Avalanche",
			ChainID:            ChainIDAvalanche,
			NativeToken:        "AVAX",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyEIP1559,
			IsEnabled:          true,
		},
		{
			Name:               "BNB Chain",
			ChainID:            ChainIDBNBChain,
			NativeToken:        "BNB",
			ConfirmationBlocks: 3,
			GasStrategy:        GasStrategyLegacy,
			IsEnabled:          true,
		},
		{
			Name:               "zkSync Era",
			ChainID:            ChainIDZkSyncEra,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Linea",
			ChainID:            ChainIDLinea,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Scroll",
			ChainID:            ChainIDScroll,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Mantle",
			ChainID:            ChainIDMantle,
			NativeToken:        "MNT",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		// Testnets
		{
			Name:               "Sepolia",
			ChainID:            ChainIDSepolia,
			NativeToken:        "ETH",
			ConfirmationBlocks: 2,
			GasStrategy:        GasStrategyEIP1559,
			IsEnabled:          true,
		},
		{
			Name:               "Base Sepolia",
			ChainID:            ChainIDBaseSepolia,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
		{
			Name:               "Arbitrum Sepolia",
			ChainID:            ChainIDArbitrumSepolia,
			NativeToken:        "ETH",
			ConfirmationBlocks: 1,
			GasStrategy:        GasStrategyL2Compressed,
			IsEnabled:          true,
		},
	}
}
