package node

import (
	"context"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
)

// GasPricer implements EIP-1559 gas pricing strategy
type GasPricer struct {
	mu              sync.RWMutex
	client          *ethclient.Client
	baseFee         *big.Int
	maxPriorityFee  *big.Int
	maxFeePerGas    *big.Int
	lastUpdate      time.Time
	updateInterval  time.Duration
	gasPriceMultiplier float64 // For urgency adjustment
}

// GasPriceEstimate contains the gas price recommendation
type GasPriceEstimate struct {
	BaseFee        *big.Int `json:"base_fee"`
	MaxPriorityFee *big.Int `json:"max_priority_fee"`
	MaxFeePerGas   *big.Int `json:"max_fee_per_gas"`
	GasPrice       *big.Int `json:"gas_price"` // Legacy fallback
	EstimatedCost  *big.Int `json:"estimated_cost"` // For 21000 gas
	Urgency        string   `json:"urgency"` // "low", "medium", "high", "urgent"
}

// NewGasPricer creates a new EIP-1559 gas pricer
func NewGasPricer(client *ethclient.Client) *GasPricer {
	return &GasPricer{
		client:             client,
		baseFee:            big.NewInt(20_000_000_000), // 20 Gwei default
		maxPriorityFee:     big.NewInt(2_000_000_000),  // 2 Gwei default
		maxFeePerGas:       big.NewInt(50_000_000_000), // 50 Gwei default
		updateInterval:     12 * time.Second,          // Every block
		gasPriceMultiplier: 1.0,
	}
}

// Start begins the gas price monitoring loop
func (gp *GasPricer) Start(ctx context.Context) {
	ticker := time.NewTicker(gp.updateInterval)
	defer ticker.Stop()

	// Initial update
	gp.Update(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			gp.Update(ctx)
		}
	}
}

// Update fetches the latest gas prices from the network
func (gp *GasPricer) Update(ctx context.Context) error {
	gp.mu.Lock()
	defer gp.mu.Unlock()

	if gp.client == nil {
		return nil
	}

	// Get the latest block for base fee
	block, err := gp.client.BlockByNumber(ctx, nil)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to fetch block for gas pricing")
		return err
	}

	if block.BaseFee() != nil {
		gp.baseFee = block.BaseFee()
	}

	// Get suggested gas tip cap (priority fee)
	tipCap, err := gp.client.SuggestGasTipCap(ctx)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to fetch gas tip cap")
	} else {
		gp.maxPriorityFee = tipCap
	}

	// Calculate max fee per gas: base fee * 2 + priority fee (standard EIP-1559)
	maxFee := new(big.Int).Mul(gp.baseFee, big.NewInt(2))
	maxFee.Add(maxFee, gp.maxPriorityFee)
	gp.maxFeePerGas = maxFee

	gp.lastUpdate = time.Now()

	log.Debug().
		Str("base_fee", formatGwei(gp.baseFee)).
		Str("priority_fee", formatGwei(gp.maxPriorityFee)).
		Str("max_fee", formatGwei(gp.maxFeePerGas)).
		Msg("Gas prices updated")

	return nil
}

// GetEstimate returns gas price estimates for different urgency levels
func (gp *GasPricer) GetEstimate(urgency string) GasPriceEstimate {
	gp.mu.RLock()
	defer gp.mu.RUnlock()

	var multiplier float64
	switch urgency {
	case "low":
		multiplier = 0.8
	case "medium":
		multiplier = 1.0
	case "high":
		multiplier = 1.25
	case "urgent":
		multiplier = 1.5
	default:
		multiplier = 1.0
		urgency = "medium"
	}

	// Apply multiplier to priority fee
	adjustedPriority := new(big.Int).Set(gp.maxPriorityFee)
	adjustedPriority.Mul(adjustedPriority, big.NewInt(int64(multiplier*100)))
	adjustedPriority.Div(adjustedPriority, big.NewInt(100))

	// Calculate adjusted max fee
	maxFee := new(big.Int).Mul(gp.baseFee, big.NewInt(2))
	maxFee.Add(maxFee, adjustedPriority)

	// Legacy gas price (for non-EIP-1559 chains)
	legacyPrice := new(big.Int).Add(gp.baseFee, adjustedPriority)

	// Estimated cost for basic transfer (21000 gas)
	estimatedCost := new(big.Int).Mul(maxFee, big.NewInt(21000))

	return GasPriceEstimate{
		BaseFee:        new(big.Int).Set(gp.baseFee),
		MaxPriorityFee: adjustedPriority,
		MaxFeePerGas:   maxFee,
		GasPrice:       legacyPrice,
		EstimatedCost:  estimatedCost,
		Urgency:        urgency,
	}
}

// GetBaseFee returns the current base fee
func (gp *GasPricer) GetBaseFee() *big.Int {
	gp.mu.RLock()
	defer gp.mu.RUnlock()
	return new(big.Int).Set(gp.baseFee)
}

// GetMaxPriorityFee returns the recommended priority fee
func (gp *GasPricer) GetMaxPriorityFee() *big.Int {
	gp.mu.RLock()
	defer gp.mu.RUnlock()
	return new(big.Int).Set(gp.maxPriorityFee)
}

// GetMaxFeePerGas returns the recommended max fee per gas
func (gp *GasPricer) GetMaxFeePerGas() *big.Int {
	gp.mu.RLock()
	defer gp.mu.RUnlock()
	return new(big.Int).Set(gp.maxFeePerGas)
}

// SetMultiplier sets the gas price multiplier for urgency
func (gp *GasPricer) SetMultiplier(multiplier float64) {
	gp.mu.Lock()
	defer gp.mu.Unlock()
	gp.gasPriceMultiplier = multiplier
}

// IsStale returns true if gas prices haven't been updated recently
func (gp *GasPricer) IsStale() bool {
	gp.mu.RLock()
	defer gp.mu.RUnlock()
	return time.Since(gp.lastUpdate) > gp.updateInterval*3
}

// formatGwei formats wei to Gwei string
func formatGwei(wei *big.Int) string {
	if wei == nil {
		return "0 Gwei"
	}
	gwei := new(big.Int).Div(wei, big.NewInt(1_000_000_000))
	return gwei.String() + " Gwei"
}
