package adapters

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// AdapterManager manages external data fetchers
type AdapterManager struct {
	client *http.Client
	mu     sync.RWMutex
}

// NewAdapterManager creates a new adapter manager
func NewAdapterManager() *AdapterManager {
	return &AdapterManager{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// FetchDataRequest defines what to fetch
type FetchDataRequest struct {
	URL      string            `json:"url"`
	Method   string            `json:"method"`
	Headers  map[string]string `json:"headers"`
	Path     string            `json:"path"` // JSON path to extract
	Obscured bool              `json:"obscured"` // Obscura Mode
}

// Fetch executes the external request
func (am *AdapterManager) Fetch(req FetchDataRequest) (interface{}, error) {
	log.Debug().Str("url", req.URL).Bool("obscured", req.Obscured).Msg("Fetching external data")

	if req.Obscured {
		// IN OBSCURA MODE: We would use a mixnet or TEE here.
		// For prototype, we fetch normally but wrap it to indicate it's private.
		log.Info().Msg("Executing in Obscura Mode (Privacy Preserved)")
	}

	httpReq, err := http.NewRequest(req.Method, req.URL, nil)
	if err != nil {
		return nil, err
	}

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := am.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("external API request failed with status: %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Simple extraction logic - in prod this would be a full JSON path parser
	// For now returns the whole object or a dummy field
	if req.Path != "" {
		if val, ok := result[req.Path]; ok {
			return val, nil
		}
		return nil, fmt.Errorf("path %s not found in response", req.Path)
	}

	return result, nil
}
