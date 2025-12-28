package automation

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/obscura-network/obscura-node/oracle"
	"github.com/rs/zerolog/log"
)

// TriggerType defines the type of automation trigger
type TriggerType string

const (
	TriggerTypePriceThreshold TriggerType = "PriceThreshold"
	TriggerTypeDeviation      TriggerType = "Deviation"      // Update when price changes by X%
	TriggerTypeHeartbeat      TriggerType = "Heartbeat"      // Update every N seconds
	TriggerTypeCustom         TriggerType = "Custom"
)

// Condition defines a trigger condition
type Condition struct {
	ID           string
	Type         TriggerType
	FeedID       string                 // Which feed this trigger monitors
	Params       map[string]interface{} // Trigger-specific parameters
	Target       string                 // Address or callback
	LastTriggered time.Time             // When this trigger last fired
	LastValue    float64                // Last known value (for deviation)
	Active       bool
}

// DeviationConfig holds deviation trigger configuration
type DeviationConfig struct {
	ThresholdPercent float64       // Trigger if price moves more than this %
	MinInterval      time.Duration // Minimum time between updates
}

// HeartbeatConfig holds heartbeat trigger configuration
type HeartbeatConfig struct {
	Interval time.Duration // How often to update regardless of price
}

// TriggerManager handles conditional execution
type TriggerManager struct {
	mu               sync.RWMutex
	tasks            map[string]*Condition
	jobQueue         chan<- oracle.JobRequest
	feedManager      *oracle.FeedManager
	checkInterval    time.Duration
}

// NewTriggerManager creates a new automation manager
func NewTriggerManager(queue chan<- oracle.JobRequest) *TriggerManager {
	return &TriggerManager{
		tasks:         make(map[string]*Condition),
		jobQueue:      queue,
		checkInterval: 1 * time.Second, // Check every second for heartbeats
	}
}

// SetFeedManager sets the feed manager for price lookups
func (tm *TriggerManager) SetFeedManager(fm *oracle.FeedManager) {
	tm.feedManager = fm
}

// RegisterTask adds a new automation task
func (tm *TriggerManager) RegisterTask(c Condition) string {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if c.ID == "" {
		c.ID = fmt.Sprintf("trigger-%d", time.Now().UnixNano())
	}
	c.Active = true
	c.LastTriggered = time.Time{}
	
	tm.tasks[c.ID] = &c
	log.Info().
		Str("id", c.ID).
		Str("type", string(c.Type)).
		Str("feed", c.FeedID).
		Msg("Automation Task Registered")
	
	return c.ID
}

// RegisterDeviationTrigger creates a deviation-based trigger (Chainlink-style)
func (tm *TriggerManager) RegisterDeviationTrigger(feedID string, thresholdPercent float64, minInterval time.Duration, target string) string {
	return tm.RegisterTask(Condition{
		Type:   TriggerTypeDeviation,
		FeedID: feedID,
		Target: target,
		Params: map[string]interface{}{
			"threshold_percent": thresholdPercent,
			"min_interval_ms":   minInterval.Milliseconds(),
		},
	})
}

// RegisterHeartbeatTrigger creates a time-based trigger (Chainlink-style)
func (tm *TriggerManager) RegisterHeartbeatTrigger(feedID string, interval time.Duration, target string) string {
	return tm.RegisterTask(Condition{
		Type:   TriggerTypeHeartbeat,
		FeedID: feedID,
		Target: target,
		Params: map[string]interface{}{
			"interval_ms": interval.Milliseconds(),
		},
	})
}

// DeactivateTrigger disables a trigger without removing it
func (tm *TriggerManager) DeactivateTrigger(id string) bool {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if task, exists := tm.tasks[id]; exists {
		task.Active = false
		return true
	}
	return false
}

// RemoveTrigger removes a trigger completely
func (tm *TriggerManager) RemoveTrigger(id string) bool {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if _, exists := tm.tasks[id]; exists {
		delete(tm.tasks, id)
		return true
	}
	return false
}

// GetActiveTriggers returns all active triggers
func (tm *TriggerManager) GetActiveTriggers() []Condition {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	
	result := make([]Condition, 0)
	for _, task := range tm.tasks {
		if task.Active {
			result = append(result, *task)
		}
	}
	return result
}

// CheckConditions is the loop that verifies triggers
func (tm *TriggerManager) CheckConditions(ctx context.Context) {
	ticker := time.NewTicker(tm.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tm.evaluate()
		}
	}
}

func (tm *TriggerManager) evaluate() {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if len(tm.tasks) == 0 {
		return
	}

	now := time.Now()

	for _, task := range tm.tasks {
		if !task.Active {
			continue
		}

		switch task.Type {
		case TriggerTypePriceThreshold:
			tm.evaluatePriceThreshold(task, now)
			
		case TriggerTypeDeviation:
			tm.evaluateDeviation(task, now)
			
		case TriggerTypeHeartbeat:
			tm.evaluateHeartbeat(task, now)
		}
	}
}

func (tm *TriggerManager) evaluatePriceThreshold(task *Condition, now time.Time) {
	threshold, _ := task.Params["threshold"].(float64)
	current, _ := task.Params["current"].(float64)

	if current >= threshold {
		log.Info().
			Str("trigger_id", task.ID).
			Str("target", task.Target).
			Float64("current", current).
			Float64("threshold", threshold).
			Msg("Automation Trigger: Price Threshold Reached")

		tm.dispatchJob(task, "price_threshold", current)
		task.LastTriggered = now
	}
}

func (tm *TriggerManager) evaluateDeviation(task *Condition, now time.Time) {
	thresholdPercent, _ := task.Params["threshold_percent"].(float64)
	minIntervalMs, _ := task.Params["min_interval_ms"].(int64)
	minInterval := time.Duration(minIntervalMs) * time.Millisecond

	// Check if minimum interval has passed
	if !task.LastTriggered.IsZero() && now.Sub(task.LastTriggered) < minInterval {
		return
	}

	// Get current price from feed manager
	currentPrice := tm.getCurrentPrice(task.FeedID)
	if currentPrice == 0 {
		return
	}

	// First time - just store the value
	if task.LastValue == 0 {
		task.LastValue = currentPrice
		return
	}

	// Calculate deviation percentage
	deviation := math.Abs((currentPrice - task.LastValue) / task.LastValue * 100)

	if deviation >= thresholdPercent {
		log.Info().
			Str("trigger_id", task.ID).
			Str("feed", task.FeedID).
			Float64("last_price", task.LastValue).
			Float64("current_price", currentPrice).
			Float64("deviation_percent", deviation).
			Float64("threshold_percent", thresholdPercent).
			Msg("Automation Trigger: Deviation Threshold Exceeded")

		tm.dispatchJob(task, "deviation", currentPrice)
		task.LastValue = currentPrice
		task.LastTriggered = now
	}
}

func (tm *TriggerManager) evaluateHeartbeat(task *Condition, now time.Time) {
	intervalMs, _ := task.Params["interval_ms"].(int64)
	interval := time.Duration(intervalMs) * time.Millisecond

	// First time - trigger immediately
	if task.LastTriggered.IsZero() {
		task.LastTriggered = now
		currentPrice := tm.getCurrentPrice(task.FeedID)
		
		log.Info().
			Str("trigger_id", task.ID).
			Str("feed", task.FeedID).
			Dur("interval", interval).
			Msg("Automation Trigger: Heartbeat Initial Update")

		tm.dispatchJob(task, "heartbeat_init", currentPrice)
		return
	}

	// Check if interval has elapsed
	if now.Sub(task.LastTriggered) >= interval {
		currentPrice := tm.getCurrentPrice(task.FeedID)
		
		log.Info().
			Str("trigger_id", task.ID).
			Str("feed", task.FeedID).
			Dur("interval", interval).
			Dur("elapsed", now.Sub(task.LastTriggered)).
			Msg("Automation Trigger: Heartbeat Update")

		tm.dispatchJob(task, "heartbeat", currentPrice)
		task.LastValue = currentPrice
		task.LastTriggered = now
	}
}

func (tm *TriggerManager) getCurrentPrice(feedID string) float64 {
	if tm.feedManager == nil {
		return 0
	}

	status := tm.feedManager.GetLiveStatus()
	for _, feed := range status {
		if feed.ID == feedID {
			// Parse price from string like "$3,847.52"
			var price float64
			fmt.Sscanf(feed.Value, "$%f", &price)
			return price
		}
	}
	return 0
}

func (tm *TriggerManager) dispatchJob(task *Condition, reason string, value float64) {
	if tm.jobQueue == nil {
		return
	}

	job := oracle.JobRequest{
		ID:        fmt.Sprintf("auto-%s-%d", task.ID, time.Now().UnixNano()),
		Type:      oracle.JobTypeDataFeed,
		Timestamp: time.Now(),
		Params: map[string]interface{}{
			"feed_id":        task.FeedID,
			"trigger_reason": reason,
			"trigger_id":     task.ID,
			"value":          value,
			"target":         task.Target,
		},
	}

	select {
	case tm.jobQueue <- job:
		log.Debug().Str("job_id", job.ID).Msg("Automation job dispatched")
	default:
		log.Warn().Str("job_id", job.ID).Msg("Job queue full, dropping automation job")
	}
}
