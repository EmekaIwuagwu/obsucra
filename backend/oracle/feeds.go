package oracle

import (
	"math/big"
	"sync"
	"time"
)

// FeedConfig defines a persistent data feed configuration (Chainlink-style)
type FeedConfig struct {
	ID                string
	Name              string
	Description       string
	Decimals          uint8
	MinResponses      uint32
	MaxResponses      uint32
	DeviationThreshold *big.Int // Basis points (e.g., 50 = 0.5%)
	HeartbeatInterval time.Duration
	OracleAddresses   []string
	DataSources       []DataSource
	AggregationMethod string // "median", "mean", "mode"
	CreatedAt         time.Time
	UpdatedAt         time.Time
	Active            bool
}

// DataSource represents an external data endpoint
type DataSource struct {
	URL     string
	Path    string
	Weight  float64
	Timeout time.Duration
}

// FeedManager manages feed configurations and lifecycle
type FeedManager struct {
	feeds map[string]*FeedConfig
	mu    sync.RWMutex
}

// NewFeedManager creates a new feed configuration manager
func NewFeedManager() *FeedManager {
	return &FeedManager{
		feeds: make(map[string]*FeedConfig),
	}
}

// RegisterFeed adds or updates a feed configuration
func (fm *FeedManager) RegisterFeed(config *FeedConfig) error {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	
	config.UpdatedAt = time.Now()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = time.Now()
	}
	
	fm.feeds[config.ID] = config
	return nil
}

// GetFeed retrieves a feed configuration by ID
func (fm *FeedManager) GetFeed(id string) (*FeedConfig, bool) {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	
	feed, exists := fm.feeds[id]
	return feed, exists
}

// ListActiveFeeds returns all active feed configurations
func (fm *FeedManager) ListActiveFeeds() []*FeedConfig {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	
	var active []*FeedConfig
	for _, feed := range fm.feeds {
		if feed.Active {
			active = append(active, feed)
		}
	}
	return active
}

// DeactivateFeed marks a feed as inactive
func (fm *FeedManager) DeactivateFeed(id string) {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	
	if feed, exists := fm.feeds[id]; exists {
		feed.Active = false
		feed.UpdatedAt = time.Now()
	}
}
