package security

import (
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// AccessController manages consumer access control, whitelisting, and rate limiting
type AccessController struct {
	mu              sync.RWMutex
	whitelist       map[string]*Consumer
	rateLimiters    map[string]*RateLimiter
	globalRateLimit int           // Max requests per minute globally
	defaultLimit    int           // Default rate limit per consumer
	enabled         bool
}

// Consumer represents a whitelisted consumer
type Consumer struct {
	Address     string
	Name        string
	Tier        ConsumerTier
	RateLimit   int       // Requests per minute
	AllowedAt   time.Time // When this consumer was added
	LastRequest time.Time
	TotalCalls  uint64
	Active      bool
}

// ConsumerTier defines access levels
type ConsumerTier string

const (
	TierFree       ConsumerTier = "free"       // Basic access with low rate limits
	TierStandard   ConsumerTier = "standard"   // Normal access
	TierPremium    ConsumerTier = "premium"    // Higher limits, priority
	TierEnterprise ConsumerTier = "enterprise" // Unlimited, dedicated
	TierInternal   ConsumerTier = "internal"   // Node operators
)

// TierLimits defines rate limits per tier (requests per minute)
var TierLimits = map[ConsumerTier]int{
	TierFree:       10,
	TierStandard:   60,
	TierPremium:    300,
	TierEnterprise: 10000,
	TierInternal:   100000,
}

// RateLimiter tracks request rates for a consumer
type RateLimiter struct {
	mu           sync.Mutex
	requests     []time.Time
	windowSize   time.Duration
	maxRequests  int
}

// NewAccessController creates a new access controller
func NewAccessController() *AccessController {
	ac := &AccessController{
		whitelist:       make(map[string]*Consumer),
		rateLimiters:    make(map[string]*RateLimiter),
		globalRateLimit: 1000,
		defaultLimit:    60,
		enabled:         true,
	}

	// Add some default internal addresses
	ac.AddConsumer("0x0000000000000000000000000000000000000000", "Null Address", TierInternal)
	
	return ac
}

// Enable enables access control
func (ac *AccessController) Enable() {
	ac.mu.Lock()
	defer ac.mu.Unlock()
	ac.enabled = true
	log.Info().Msg("Access control enabled")
}

// Disable disables access control (allow all)
func (ac *AccessController) Disable() {
	ac.mu.Lock()
	defer ac.mu.Unlock()
	ac.enabled = false
	log.Warn().Msg("Access control disabled - all requests allowed")
}

// IsEnabled returns whether access control is enabled
func (ac *AccessController) IsEnabled() bool {
	ac.mu.RLock()
	defer ac.mu.RUnlock()
	return ac.enabled
}

// AddConsumer adds a consumer to the whitelist
func (ac *AccessController) AddConsumer(address, name string, tier ConsumerTier) {
	ac.mu.Lock()
	defer ac.mu.Unlock()

	rateLimit := TierLimits[tier]
	if rateLimit == 0 {
		rateLimit = ac.defaultLimit
	}

	ac.whitelist[address] = &Consumer{
		Address:   address,
		Name:      name,
		Tier:      tier,
		RateLimit: rateLimit,
		AllowedAt: time.Now(),
		Active:    true,
	}

	ac.rateLimiters[address] = &RateLimiter{
		requests:    make([]time.Time, 0),
		windowSize:  time.Minute,
		maxRequests: rateLimit,
	}

	log.Info().
		Str("address", address).
		Str("name", name).
		Str("tier", string(tier)).
		Int("rate_limit", rateLimit).
		Msg("Consumer added to whitelist")
}

// RemoveConsumer removes a consumer from the whitelist
func (ac *AccessController) RemoveConsumer(address string) bool {
	ac.mu.Lock()
	defer ac.mu.Unlock()

	if _, exists := ac.whitelist[address]; exists {
		delete(ac.whitelist, address)
		delete(ac.rateLimiters, address)
		log.Info().Str("address", address).Msg("Consumer removed from whitelist")
		return true
	}
	return false
}

// DeactivateConsumer disables a consumer without removing
func (ac *AccessController) DeactivateConsumer(address string) bool {
	ac.mu.Lock()
	defer ac.mu.Unlock()

	if consumer, exists := ac.whitelist[address]; exists {
		consumer.Active = false
		log.Info().Str("address", address).Msg("Consumer deactivated")
		return true
	}
	return false
}

// ActivateConsumer re-enables a consumer
func (ac *AccessController) ActivateConsumer(address string) bool {
	ac.mu.Lock()
	defer ac.mu.Unlock()

	if consumer, exists := ac.whitelist[address]; exists {
		consumer.Active = true
		log.Info().Str("address", address).Msg("Consumer activated")
		return true
	}
	return false
}

// UpdateTier changes a consumer's tier and rate limit
func (ac *AccessController) UpdateTier(address string, tier ConsumerTier) bool {
	ac.mu.Lock()
	defer ac.mu.Unlock()

	if consumer, exists := ac.whitelist[address]; exists {
		consumer.Tier = tier
		consumer.RateLimit = TierLimits[tier]
		
		if limiter, ok := ac.rateLimiters[address]; ok {
			limiter.maxRequests = consumer.RateLimit
		}
		
		log.Info().
			Str("address", address).
			Str("tier", string(tier)).
			Int("rate_limit", consumer.RateLimit).
			Msg("Consumer tier updated")
		return true
	}
	return false
}

// CheckAccess verifies if a consumer can make a request
func (ac *AccessController) CheckAccess(address string) (bool, string) {
	ac.mu.Lock()
	defer ac.mu.Unlock()

	// If access control is disabled, allow all
	if !ac.enabled {
		return true, "access_control_disabled"
	}

	// Check if consumer is whitelisted
	consumer, exists := ac.whitelist[address]
	if !exists {
		log.Debug().Str("address", address).Msg("Access denied: not whitelisted")
		return false, "not_whitelisted"
	}

	// Check if consumer is active
	if !consumer.Active {
		log.Debug().Str("address", address).Msg("Access denied: consumer deactivated")
		return false, "consumer_deactivated"
	}

	// Check rate limit
	limiter, ok := ac.rateLimiters[address]
	if !ok {
		return false, "no_rate_limiter"
	}

	allowed, reason := limiter.Allow()
	if !allowed {
		log.Debug().
			Str("address", address).
			Str("reason", reason).
			Msg("Access denied: rate limited")
		return false, reason
	}

	// Update consumer stats
	consumer.LastRequest = time.Now()
	consumer.TotalCalls++

	return true, "allowed"
}

// GetConsumer returns consumer info
func (ac *AccessController) GetConsumer(address string) (*Consumer, bool) {
	ac.mu.RLock()
	defer ac.mu.RUnlock()

	consumer, exists := ac.whitelist[address]
	if !exists {
		return nil, false
	}
	
	// Return a copy
	copy := *consumer
	return &copy, true
}

// ListConsumers returns all whitelisted consumers
func (ac *AccessController) ListConsumers() []Consumer {
	ac.mu.RLock()
	defer ac.mu.RUnlock()

	result := make([]Consumer, 0, len(ac.whitelist))
	for _, consumer := range ac.whitelist {
		result = append(result, *consumer)
	}
	return result
}

// GetStats returns access control statistics
func (ac *AccessController) GetStats() map[string]interface{} {
	ac.mu.RLock()
	defer ac.mu.RUnlock()

	activeCount := 0
	totalCalls := uint64(0)
	tierCounts := make(map[ConsumerTier]int)

	for _, consumer := range ac.whitelist {
		if consumer.Active {
			activeCount++
		}
		totalCalls += consumer.TotalCalls
		tierCounts[consumer.Tier]++
	}

	return map[string]interface{}{
		"enabled":           ac.enabled,
		"total_consumers":   len(ac.whitelist),
		"active_consumers":  activeCount,
		"total_calls":       totalCalls,
		"tier_distribution": tierCounts,
	}
}

// Allow checks if a request is allowed under the rate limit
func (rl *RateLimiter) Allow() (bool, string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.windowSize)

	// Remove old requests outside the window
	validRequests := make([]time.Time, 0)
	for _, t := range rl.requests {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}
	rl.requests = validRequests

	// Check if we're at the limit
	if len(rl.requests) >= rl.maxRequests {
		return false, "rate_limit_exceeded"
	}

	// Record this request
	rl.requests = append(rl.requests, now)
	return true, "allowed"
}

// GetCurrentRate returns the current request rate
func (rl *RateLimiter) GetCurrentRate() int {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.windowSize)

	count := 0
	for _, t := range rl.requests {
		if t.After(windowStart) {
			count++
		}
	}
	return count
}

// GetRemainingQuota returns how many requests are left in the current window
func (rl *RateLimiter) GetRemainingQuota() int {
	return rl.maxRequests - rl.GetCurrentRate()
}
