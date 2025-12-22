package adapters

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdapterFetch(t *testing.T) {
	// Mock Server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"price": 65000.50}`))
	}))
	defer server.Close()

	mgr := NewAdapterManager()
	req := FetchDataRequest{
		URL:    server.URL,
		Method: "GET",
		Path:   "price",
	}

	result, err := mgr.Fetch(req)
	if err != nil {
		t.Fatalf("Fetch error: %v", err)
	}
	if result != 65000.50 {
		t.Errorf("Expected 65000.50, got %v", result)
	}
}

func TestAdapterRetry(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"price": 100.0}`))
	}))
	defer server.Close()

	mgr := NewAdapterManager()
	req := FetchDataRequest{
		URL:     server.URL,
		Method:  "GET",
		Path:    "price",
		Retries: 3,
	}

	result, err := mgr.Fetch(req)
	if err != nil {
		t.Fatalf("Fetch error: %v", err)
	}
	if result != 100.0 {
		t.Errorf("Expected 100.0, got %v", result)
	}
	if attempts != 2 {
		t.Errorf("Expected 2 attempts, got %d", attempts)
	}
}
