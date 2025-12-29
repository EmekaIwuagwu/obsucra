package staking

import (
	"fmt"
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

// DistributeRewards calculates and distributes staking rewards to all stakers
// Rewards are calculated based on stake amount and duration at 5% APY base rate
func (sg *StakeGuard) DistributeRewards() {
	sg.mu.Lock()
	defer sg.mu.Unlock()

	// Base APY rate of 5% annually, calculated per distribution period
	// Assuming daily distribution: 5% / 365 = ~0.0137% per day
	const dailyRateBPS = 137 // 0.0137% in basis points (1 bps = 0.01%)

	for addr, staker := range sg.stakers {
		if staker.Amount.Sign() <= 0 {
			continue
		}

		// Calculate reward: amount * dailyRate / 1,000,000 (to handle basis points)
		reward := new(big.Int).Mul(staker.Amount, big.NewInt(dailyRateBPS))
		reward.Div(reward, big.NewInt(1000000))

		// Add reward to stake
		staker.Amount.Add(staker.Amount, reward)

		log.Info().
			Str("address", addr).
			Str("reward", reward.String()).
			Str("new_balance", staker.Amount.String()).
			Msg("Reward distributed")
	}
}

// GetStaker returns information about a staker
func (sg *StakeGuard) GetStaker(address string) (*Staker, bool) {
	sg.mu.RLock()
	defer sg.mu.RUnlock()
	staker, exists := sg.stakers[address]
	return staker, exists
}

// GetTotalStaked returns the total amount staked across all stakers
func (sg *StakeGuard) GetTotalStaked() *big.Int {
	sg.mu.RLock()
	defer sg.mu.RUnlock()

	total := big.NewInt(0)
	for _, staker := range sg.stakers {
		total.Add(total, staker.Amount)
	}
	return total
}

// WithdrawStake allows a staker to withdraw after lock period
func (sg *StakeGuard) WithdrawStake(address string) (*big.Int, error) {
	sg.mu.Lock()
	defer sg.mu.Unlock()

	staker, exists := sg.stakers[address]
	if !exists {
		return nil, fmt.Errorf("staker not found")
	}

	if time.Now().Before(staker.LockedUntil) {
		return nil, fmt.Errorf("stake still locked until %v", staker.LockedUntil)
	}

	amount := staker.Amount
	delete(sg.stakers, address)

	log.Info().Str("address", address).Str("amount", amount.String()).Msg("Stake withdrawn")
	return amount, nil
}
