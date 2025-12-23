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

// FeedLiveStatus tracks the current state and statistics of a feed
type FeedLiveStatus struct {
	ID                 string    `json:"id"`
	Value              string    `json:"value"`
	Confidence         float64   `json:"confidence"`
	Outliers           int       `json:"outliers"`
	RoundID            uint64    `json:"round_id"`
	Timestamp          time.Time `json:"timestamp"`
	IsZK               bool      `json:"is_zk"`
	IsOptimistic       bool      `json:"is_optimistic"`
	ConfidenceInterval string    `json:"confidence_interval"` // e.g. "± 1.2%"
}

// FeedManager manages feed configurations and lifecycle
type FeedManager struct {
	feeds      map[string]*FeedConfig
	liveStatus map[string]*FeedLiveStatus
	mu         sync.RWMutex
}

// NewFeedManager creates a new feed configuration manager
func NewFeedManager() *FeedManager {
	return &FeedManager{
		feeds:      make(map[string]*FeedConfig),
		liveStatus: make(map[string]*FeedLiveStatus),
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

// UpdateFeedValue updates the live tracking for a feed
func (fm *FeedManager) UpdateFeedValue(status FeedLiveStatus) {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	
	fm.liveStatus[status.ID] = &status
}

// GetLiveStatus returns the current live data for all active feeds
func (fm *FeedManager) GetLiveStatus() []FeedLiveStatus {
	fm.mu.RLock()
	defer fm.mu.RUnlock()
	
	var status []FeedLiveStatus
	for id, s := range fm.liveStatus {
		if feed, ok := fm.feeds[id]; ok && feed.Active {
			status = append(status, *s)
		}
	}
	return status
}
