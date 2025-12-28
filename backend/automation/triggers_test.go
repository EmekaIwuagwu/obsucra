package automation

import (
	"testing"
	"time"

	"github.com/obscura-network/obscura-node/oracle"
)

func TestDeviationTrigger(t *testing.T) {
	jobQueue := make(chan oracle.JobRequest, 10)
	tm := NewTriggerManager(jobQueue)

	// Create a feed manager with test data
	fm := oracle.NewFeedManager()
	fm.RegisterFeed(&oracle.FeedConfig{
		ID:     "ETH-USD",
		Name:   "Ethereum / US Dollar",
		Active: true,
	})
	tm.SetFeedManager(fm)

	// Register a 5% deviation trigger
	triggerID := tm.RegisterDeviationTrigger("ETH-USD", 5.0, 100*time.Millisecond, "0x742d35Cc6634C0532925a3b844Bc9e7595f4e032")

	if triggerID == "" {
		t.Error("Expected trigger ID to be returned")
	}

	triggers := tm.GetActiveTriggers()
	if len(triggers) != 1 {
		t.Errorf("Expected 1 active trigger, got %d", len(triggers))
	}

	if triggers[0].Type != TriggerTypeDeviation {
		t.Errorf("Expected Deviation trigger type, got %s", triggers[0].Type)
	}

	t.Log("✅ Deviation trigger registration test passed")
}

func TestHeartbeatTrigger(t *testing.T) {
	jobQueue := make(chan oracle.JobRequest, 10)
	tm := NewTriggerManager(jobQueue)

	// Register a 1-hour heartbeat trigger
	triggerID := tm.RegisterHeartbeatTrigger("BTC-USD", 1*time.Hour, "0xB8c77482e45F1F44dE1745F52C74426C631bDD52")

	if triggerID == "" {
		t.Error("Expected trigger ID to be returned")
	}

	triggers := tm.GetActiveTriggers()
	if len(triggers) != 1 {
		t.Errorf("Expected 1 active trigger, got %d", len(triggers))
	}

	if triggers[0].Type != TriggerTypeHeartbeat {
		t.Errorf("Expected Heartbeat trigger type, got %s", triggers[0].Type)
	}

	// Verify interval is stored correctly
	intervalMs, ok := triggers[0].Params["interval_ms"].(int64)
	if !ok || intervalMs != 3600000 {
		t.Errorf("Expected interval_ms of 3600000, got %v", triggers[0].Params["interval_ms"])
	}

	t.Log("✅ Heartbeat trigger registration test passed")
}

func TestTriggerDeactivation(t *testing.T) {
	jobQueue := make(chan oracle.JobRequest, 10)
	tm := NewTriggerManager(jobQueue)

	// Register triggers with small delay to ensure unique IDs
	id1 := tm.RegisterHeartbeatTrigger("ETH-USD", 1*time.Hour, "target1")
	time.Sleep(1 * time.Millisecond)
	id2 := tm.RegisterDeviationTrigger("BTC-USD", 5.0, 1*time.Minute, "target2")

	// Should have 2 active triggers
	active := tm.GetActiveTriggers()
	if len(active) != 2 {
		t.Errorf("Expected 2 active triggers, got %d", len(active))
		return
	}

	// Deactivate first trigger
	if !tm.DeactivateTrigger(id1) {
		t.Error("Failed to deactivate trigger")
	}

	// Should have 1 active trigger now
	active = tm.GetActiveTriggers()
	if len(active) != 1 {
		t.Errorf("Expected 1 active trigger after deactivation, got %d", len(active))
		return
	}

	// The remaining one should be id2
	if active[0].ID != id2 {
		t.Errorf("Expected remaining trigger to be %s, got %s", id2, active[0].ID)
	}

	t.Log("✅ Trigger deactivation test passed")
}

func TestTriggerRemoval(t *testing.T) {
	jobQueue := make(chan oracle.JobRequest, 10)
	tm := NewTriggerManager(jobQueue)

	// Register trigger
	id := tm.RegisterHeartbeatTrigger("ETH-USD", 1*time.Hour, "target")

	// Remove it
	if !tm.RemoveTrigger(id) {
		t.Error("Failed to remove trigger")
	}

	// Should have no triggers
	if len(tm.GetActiveTriggers()) != 0 {
		t.Error("Expected 0 triggers after removal")
	}

	// Removing again should return false
	if tm.RemoveTrigger(id) {
		t.Error("Expected false when removing non-existent trigger")
	}

	t.Log("✅ Trigger removal test passed")
}
