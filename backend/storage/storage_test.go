package storage

import (
	"os"
	"testing"
)

func TestFileStore(t *testing.T) {
	tmpFile := "./test_db.json"
	defer os.Remove(tmpFile)

	store, err := NewFileStore(tmpFile)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}

	err = store.SaveJob("test_key", "test_value")
	if err != nil {
		t.Fatalf("Failed to save: %v", err)
	}

	val, ok := store.GetJob("test_key")
	if !ok {
		t.Fatalf("Failed to load: key not found")
	}

	if val != "test_value" {
		t.Errorf("Expected test_value, got %v", val)
	}
}
