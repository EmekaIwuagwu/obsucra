package adapters

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// PriceData represents standardized price data
type PriceData struct {
	Symbol     string    `json:"symbol"`
	Price      float64   `json:"price"`
	Volume24h  float64   `json:"volume_24h"`
	MarketCap  float64   `json:"market_cap"`
	Change24h  float64   `json:"change_24h"`
	Source     string    `json:"source"`
	Timestamp  time.Time `json:"timestamp"`
}

// DataAdapter interface for all data sources
type DataAdapter interface {
	GetPrice(symbol string) (*PriceData, error)
	GetPrices(symbols []string) ([]PriceData, error)
	Name() string
}

// PriceAdapterManager manages multiple price data adapters
type PriceAdapterManager struct {
	adapters map[string]DataAdapter
	cache    map[string]*PriceData
	cacheTTL time.Duration
	mu       sync.RWMutex
}

// NewPriceAdapterManager creates a new price adapter manager
func NewPriceAdapterManager() *PriceAdapterManager {
	am := &PriceAdapterManager{
		adapters: make(map[string]DataAdapter),
		cache:    make(map[string]*PriceData),
		cacheTTL: 10 * time.Second,
	}

	// Register default adapters
	am.Register(NewCoinGeckoAdapter())
	am.Register(NewBinanceAdapter())
	am.Register(NewCoinMarketCapAdapter("")) // API key optional for basic usage

	return am
}

// Register adds an adapter
func (am *PriceAdapterManager) Register(adapter DataAdapter) {
	am.mu.Lock()
	defer am.mu.Unlock()
	am.adapters[adapter.Name()] = adapter
	log.Info().Str("adapter", adapter.Name()).Msg("Data adapter registered")
}

// GetAggregatedPrice fetches price from multiple sources and returns median
func (am *PriceAdapterManager) GetAggregatedPrice(symbol string) (*PriceData, error) {
	am.mu.RLock()
	adapters := am.adapters
	am.mu.RUnlock()

	var prices []float64
	var successfulData *PriceData

	for name, adapter := range adapters {
		data, err := adapter.GetPrice(symbol)
		if err != nil {
			log.Warn().Str("adapter", name).Err(err).Msg("Failed to fetch price")
			continue
		}
		prices = append(prices, data.Price)
		if successfulData == nil {
			successfulData = data
		}
	}

	if len(prices) == 0 {
		return nil, fmt.Errorf("no adapters returned price for %s", symbol)
	}

	// Calculate median
	median := calculateMedian(prices)
	successfulData.Price = median
	successfulData.Source = "aggregated"

	return successfulData, nil
}

func calculateMedian(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	if len(values) == 1 {
		return values[0]
	}

	// Simple sort
	for i := 0; i < len(values)-1; i++ {
		for j := 0; j < len(values)-i-1; j++ {
			if values[j] > values[j+1] {
				values[j], values[j+1] = values[j+1], values[j]
			}
		}
	}

	mid := len(values) / 2
	if len(values)%2 == 0 {
		return (values[mid-1] + values[mid]) / 2
	}
	return values[mid]
}

// ============ COINGECKO ADAPTER ============

type CoinGeckoAdapter struct {
	baseURL string
	client  *http.Client
}

func NewCoinGeckoAdapter() *CoinGeckoAdapter {
	return &CoinGeckoAdapter{
		baseURL: "https://api.coingecko.com/api/v3",
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *CoinGeckoAdapter) Name() string {
	return "coingecko"
}

// CoinGecko ID mapping
var coinGeckoIDs = map[string]string{
	"BTC":  "bitcoin",
	"ETH":  "ethereum",
	"USDT": "tether",
	"USDC": "usd-coin",
	"BNB":  "binancecoin",
	"XRP":  "ripple",
	"SOL":  "solana",
	"ADA":  "cardano",
	"DOGE": "dogecoin",
	"AVAX": "avalanche-2",
	"LINK": "chainlink",
	"MATIC": "matic-network",
	"ARB":  "arbitrum",
	"OP":   "optimism",
}

func (c *CoinGeckoAdapter) GetPrice(symbol string) (*PriceData, error) {
	id, ok := coinGeckoIDs[symbol]
	if !ok {
		id = symbol // Try using symbol as ID
	}

	url := fmt.Sprintf("%s/simple/price?ids=%s&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true", c.baseURL, id)
	
	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]map[string]float64
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	data, exists := result[id]
	if !exists {
		return nil, fmt.Errorf("symbol not found: %s", symbol)
	}

	return &PriceData{
		Symbol:    symbol,
		Price:     data["usd"],
		Volume24h: data["usd_24h_vol"],
		MarketCap: data["usd_market_cap"],
		Change24h: data["usd_24h_change"],
		Source:    "coingecko",
		Timestamp: time.Now(),
	}, nil
}

func (c *CoinGeckoAdapter) GetPrices(symbols []string) ([]PriceData, error) {
	var results []PriceData
	for _, symbol := range symbols {
		data, err := c.GetPrice(symbol)
		if err != nil {
			continue
		}
		results = append(results, *data)
	}
	return results, nil
}

// ============ BINANCE ADAPTER ============

type BinanceAdapter struct {
	baseURL string
	client  *http.Client
}

func NewBinanceAdapter() *BinanceAdapter {
	return &BinanceAdapter{
		baseURL: "https://api.binance.com/api/v3",
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (b *BinanceAdapter) Name() string {
	return "binance"
}

func (b *BinanceAdapter) GetPrice(symbol string) (*PriceData, error) {
	// Binance uses pairs like BTCUSDT
	pair := symbol + "USDT"
	
	url := fmt.Sprintf("%s/ticker/24hr?symbol=%s", b.baseURL, pair)
	
	resp, err := b.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("binance API error: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		LastPrice      string `json:"lastPrice"`
		Volume         string `json:"volume"`
		QuoteVolume    string `json:"quoteVolume"`
		PriceChange    string `json:"priceChange"`
		PriceChangePct string `json:"priceChangePercent"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	price, _ := strconv.ParseFloat(result.LastPrice, 64)
	volume, _ := strconv.ParseFloat(result.QuoteVolume, 64)
	change, _ := strconv.ParseFloat(result.PriceChangePct, 64)

	return &PriceData{
		Symbol:    symbol,
		Price:     price,
		Volume24h: volume,
		Change24h: change,
		Source:    "binance",
		Timestamp: time.Now(),
	}, nil
}

func (b *BinanceAdapter) GetPrices(symbols []string) ([]PriceData, error) {
	var results []PriceData
	for _, symbol := range symbols {
		data, err := b.GetPrice(symbol)
		if err != nil {
			continue
		}
		results = append(results, *data)
	}
	return results, nil
}

// ============ COINMARKETCAP ADAPTER ============

type CoinMarketCapAdapter struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

func NewCoinMarketCapAdapter(apiKey string) *CoinMarketCapAdapter {
	return &CoinMarketCapAdapter{
		baseURL: "https://pro-api.coinmarketcap.com/v1",
		apiKey:  apiKey,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *CoinMarketCapAdapter) Name() string {
	return "coinmarketcap"
}

func (c *CoinMarketCapAdapter) GetPrice(symbol string) (*PriceData, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("CMC API key not configured")
	}

	url := fmt.Sprintf("%s/cryptocurrency/quotes/latest?symbol=%s", c.baseURL, symbol)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-CMC_PRO_API_KEY", c.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data map[string]struct {
			Quote struct {
				USD struct {
					Price            float64 `json:"price"`
					Volume24h        float64 `json:"volume_24h"`
					MarketCap        float64 `json:"market_cap"`
					PercentChange24h float64 `json:"percent_change_24h"`
				} `json:"USD"`
			} `json:"quote"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	data, exists := result.Data[symbol]
	if !exists {
		return nil, fmt.Errorf("symbol not found: %s", symbol)
	}

	return &PriceData{
		Symbol:    symbol,
		Price:     data.Quote.USD.Price,
		Volume24h: data.Quote.USD.Volume24h,
		MarketCap: data.Quote.USD.MarketCap,
		Change24h: data.Quote.USD.PercentChange24h,
		Source:    "coinmarketcap",
		Timestamp: time.Now(),
	}, nil
}

func (c *CoinMarketCapAdapter) GetPrices(symbols []string) ([]PriceData, error) {
	var results []PriceData
	for _, symbol := range symbols {
		data, err := c.GetPrice(symbol)
		if err != nil {
			continue
		}
		results = append(results, *data)
	}
	return results, nil
}

// ============ CRYPTOCOMPARE ADAPTER ============

type CryptoCompareAdapter struct {
	baseURL string
	client  *http.Client
}

func NewCryptoCompareAdapter() *CryptoCompareAdapter {
	return &CryptoCompareAdapter{
		baseURL: "https://min-api.cryptocompare.com/data",
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *CryptoCompareAdapter) Name() string {
	return "cryptocompare"
}

func (c *CryptoCompareAdapter) GetPrice(symbol string) (*PriceData, error) {
	url := fmt.Sprintf("%s/pricemultifull?fsyms=%s&tsyms=USD", c.baseURL, symbol)
	
	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		RAW map[string]map[string]struct {
			Price      float64 `json:"PRICE"`
			Volume24h  float64 `json:"VOLUME24HOURTO"`
			MarketCap  float64 `json:"MKTCAP"`
			Change24h  float64 `json:"CHANGEPCT24HOUR"`
		} `json:"RAW"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	data, exists := result.RAW[symbol]
	if !exists {
		return nil, fmt.Errorf("symbol not found: %s", symbol)
	}

	usdData, exists := data["USD"]
	if !exists {
		return nil, fmt.Errorf("USD price not found for: %s", symbol)
	}

	return &PriceData{
		Symbol:    symbol,
		Price:     usdData.Price,
		Volume24h: usdData.Volume24h,
		MarketCap: usdData.MarketCap,
		Change24h: usdData.Change24h,
		Source:    "cryptocompare",
		Timestamp: time.Now(),
	}, nil
}

func (c *CryptoCompareAdapter) GetPrices(symbols []string) ([]PriceData, error) {
	var results []PriceData
	for _, symbol := range symbols {
		data, err := c.GetPrice(symbol)
		if err != nil {
			continue
		}
		results = append(results, *data)
	}
	return results, nil
}
