package staking

import (
	"math/big"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// Staker represents a node or user staking OBS
type Staker struct {
	Address string
	Amount  *big.Int
	LockedUntil time.Time
}

// StakeGuard manages locks, rewards, and slashing
type StakeGuard struct {
	stakers map[string]*Staker
	mu      sync.RWMutex
}

// NewStakeGuard initializes the staking manager
func NewStakeGuard() *StakeGuard {
	return &StakeGuard{
		stakers: make(map[string]*Staker),
	}
}

// DepositStake locks tokens for a node
func (sg *StakeGuard) DepositStake(address string, amount *big.Int, duration time.Duration) {
	sg.mu.Lock()
	defer sg.mu.Unlock()

	sg.stakers[address] = &Staker{
		Address:     address,
		Amount:      amount,
		LockedUntil: time.Now().Add(duration),
	}
	log.Info().Str("address", address).Str("amount", amount.String()).Msg("Stake Deposited")
}

// Slash penalizes a staker
func (sg *StakeGuard) Slash(address string, percentage float64) {
	sg.mu.Lock()
	defer sg.mu.Unlock()

	staker, exists := sg.stakers[address]
	if !exists {
		return
	}

	// Calculate slash amount
	slashFactor := big.NewFloat(percentage / 100.0)
	currentAmt := new(big.Float).SetInt(staker.Amount)
	slashAmtFloat := new(big.Float).Mul(currentAmt, slashFactor)
	
	slashAmt := new(big.Int)
	slashAmtFloat.Int(slashAmt)

	staker.Amount.Sub(staker.Amount, slashAmt)
	log.Warn().Str("address", address).Str("slashed", slashAmt.String()).Msg("Staker Slashed")
}

// DistributeRewards (mock)
func (sg *StakeGuard) DistributeRewards() {
	sg.mu.Lock()
	defer sg.mu.Unlock()
	// Logic to add tokens to stakers
}
