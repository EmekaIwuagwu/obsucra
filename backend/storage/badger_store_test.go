package storage

import (
	"os"
	"testing"
)

func TestBadgerStore(t *testing.T) {
	// Create a temporary directory for the test database
	testDir := "./test_badger_db"
	defer os.RemoveAll(testDir)

	// Create store
	store, err := NewBadgerStore(testDir)
	if err != nil {
		t.Fatalf("Failed to create BadgerStore: %v", err)
	}
	defer store.Close()

	// Test SaveJob and GetJob
	job := map[string]interface{}{
		"id":        "req-eth-usd-1703750400",
		"type":      "data_feed",
		"requester": "0x742d35Cc6634C0532925a3b844Bc9e7595f4e032",
	}

	if err := store.SaveJob("job1", job); err != nil {
		t.Errorf("Failed to save job: %v", err)
	}

	retrieved, found := store.GetJob("job1")
	if !found {
		t.Error("Expected to find job1")
	}
	if retrieved == nil {
		t.Error("Expected non-nil job")
	}

	// Test reputations
	if err := store.SaveReputation("0x742d35Cc6634C0532925a3b844Bc9e7595f4e032", 95.5); err != nil {
		t.Errorf("Failed to save reputation: %v", err)
	}

	rep := store.GetReputation("0x742d35Cc6634C0532925a3b844Bc9e7595f4e032")
	if rep != 95.5 {
		t.Errorf("Expected reputation 95.5, got %f", rep)
	}

	// Test default reputation
	defaultRep := store.GetReputation("0xunknown")
	if defaultRep != 50.0 {
		t.Errorf("Expected default reputation 50.0, got %f", defaultRep)
	}

	// Test GetAllJobs
	store.SaveJob("job2", map[string]interface{}{"id": "job2"})
	allJobs := store.GetAllJobs()
	if len(allJobs) != 2 {
		t.Errorf("Expected 2 jobs, got %d", len(allJobs))
	}

	// Test generic Set/Get
	if err := store.Set("config:version", "1.0.0"); err != nil {
		t.Errorf("Failed to set value: %v", err)
	}

	val, found := store.Get("config:version")
	if !found {
		t.Error("Expected to find config:version")
	}
	if val != "1.0.0" {
		t.Errorf("Expected version 1.0.0, got %v", val)
	}

	// Test Delete
	if err := store.Delete("config:version"); err != nil {
		t.Errorf("Failed to delete value: %v", err)
	}

	_, found = store.Get("config:version")
	if found {
		t.Error("Expected config:version to be deleted")
	}

	// Test Stats
	stats := store.Stats()
	if stats["type"] != "badger" {
		t.Errorf("Expected type 'badger', got %v", stats["type"])
	}

	// Test Clear
	if err := store.Clear(); err != nil {
		t.Errorf("Failed to clear store: %v", err)
	}

	allJobs = store.GetAllJobs()
	if len(allJobs) != 0 {
		t.Errorf("Expected 0 jobs after clear, got %d", len(allJobs))
	}

	t.Log("✅ BadgerStore test passed")
}

func TestBadgerStoreIntegration(t *testing.T) {
	testDir := "./test_badger_integration"
	defer os.RemoveAll(testDir)

	// Create store
	store, err := NewBadgerStore(testDir)
	if err != nil {
		t.Fatalf("Failed to create BadgerStore: %v", err)
	}
	defer store.Close()

	// Test that BadgerStore implements Store interface
	var _ Store = store

	// Simulate real job persistence
	for i := 0; i < 100; i++ {
		job := map[string]interface{}{
			"id":        i,
			"requester": "0x742d35Cc6634C0532925a3b844Bc9e7595f4e032",
		}
		if err := store.SaveJob(string(rune(i)), job); err != nil {
			t.Errorf("Failed to save job %d: %v", i, err)
		}
	}

	// Verify all were saved
	allJobs := store.GetAllJobs()
	if len(allJobs) != 100 {
		t.Errorf("Expected 100 jobs, got %d", len(allJobs))
	}

	t.Log("✅ BadgerStore integration test passed")
}
