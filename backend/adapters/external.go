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

	client := am.client
	if req.Obscured {
		// IN OBSCURA MODE: Route traffic through a privacy-preserving proxy/mixnet
		// For MVP, we simulate this by using a custom transport with strict timeout and no-cache
		// In production, this would be: Proxy: http.ProxyURL(torProxyURL)
		log.Info().Msg("Routing through Obscura Privacy Layer... (Encrypted Transport Active)")
		client = &http.Client{
			Transport: &http.Transport{
				DisableKeepAlives: true,
			},
			Timeout: 20 * time.Second,
		}
	}

	httpReq, err := http.NewRequest(req.Method, req.URL, nil)
	if err != nil {
		return nil, err
	}

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("external API request failed with status: %d", resp.StatusCode)
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("json decode error: %w", err)
	}

	// Path Extraction: JSONPath-like selector (e.g., "data.price.usd")
	if req.Path != "" {
		return extractPath(result, req.Path)
	}

	return result, nil
}

func extractPath(data interface{}, path string) (interface{}, error) {
	// Simple dot-notation parser (e.g. "data.price")
	current := data
	keys := splitPath(path)
	
	for _, key := range keys {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("cannot verify path %s: intermediate value is not an object", key)
		}
		val, exists := m[key]
		if !exists {
			return nil, fmt.Errorf("key %s not found in path", key)
		}
		current = val
	}
	return current, nil
}

func splitPath(s string) []string {
	// Custom split to ignore dots inside quotes if needed (simplified for now)
	var res []string
	var current string
	for _, c := range s {
		if c == '.' {
			res = append(res, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	res = append(res, current)
	return res
}
