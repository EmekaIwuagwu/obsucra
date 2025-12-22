package adapters

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

type CoingeckoAdapter struct {
	client *http.Client
}

func NewCoingeckoAdapter() *CoingeckoAdapter {
	return &CoingeckoAdapter{
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (ca *CoingeckoAdapter) GetPrice(id string, currency string) (float64, error) {
	url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=%s", id, currency)
	
	resp, err := ca.client.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("coingecko returned status %d", resp.StatusCode)
	}

	var result map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	price, ok := result[id][currency]
	if !ok {
		return 0, fmt.Errorf("price not found for %s in %s", id, currency)
	}

	log.Info().Str("id", id).Float64("price", price).Msg("Coingecko price fetched")
	return price, nil
}
