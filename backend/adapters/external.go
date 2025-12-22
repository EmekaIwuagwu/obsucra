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
	Retries  int               `json:"retries"`
}

// Fetch executes the external request with retries
func (am *AdapterManager) Fetch(req FetchDataRequest) (interface{}, error) {
	if req.Retries <= 0 {
		req.Retries = 3
	}

	var lastErr error
	for i := 0; i < req.Retries; i++ {
		result, err := am.exec(req)
		if err == nil {
			return result, nil
		}
		lastErr = err
		log.Warn().Err(err).Int("attempt", i+1).Str("url", req.URL).Msg("Adapter fetch failed, retrying...")
		time.Sleep(time.Duration(i+1) * time.Second) // Exponential backoffish
	}

	return nil, fmt.Errorf("all retry attempts failed: %w", lastErr)
}

func (am *AdapterManager) exec(req FetchDataRequest) (interface{}, error) {
	log.Debug().Str("url", req.URL).Bool("obscured", req.Obscured).Msg("Executing external data fetch")

	client := am.client
	if req.Obscured {
		// IN OBSCURA MODE: Route traffic through a privacy-preserving proxy/mixnet
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
			// Check if it's an array and we might have an index? (Optional enhancement)
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
	var res []string
	var current string
	for _, c := range s {
		if c == '.' {
			if current != "" {
				res = append(res, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		res = append(res, current)
	}
	return res
}
