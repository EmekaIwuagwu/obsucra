package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

type GlobalState struct {
	mu          sync.RWMutex
	Latency     string
	ActiveNodes int
	ZkProofsSec int
	PriceFeeds  []Feed
	Logs        []string
}

// ... existing GlobalState methods ...

type NetworkStats struct {
	Latency     string   `json:"latency"`
	ActiveNodes int      `json:"activeNodes"`
	ZkProofsSec int      `json:"zk_proofs_sec"`
	PriceFeeds  []Feed   `json:"price_feeds"`
	Logs        []string `json:"logs"`
}

var State = &GlobalState{
	Latency:     "12ms",
	ActiveNodes: 240,
	ZkProofsSec: 1850,
	PriceFeeds: []Feed{
		{Name: "BTC / USD", Price: "65,240.50", Status: "Verified", Trend: 1.2},
		{Name: "ETH / USD", Price: "3,450.12", Status: "Verified", Trend: -0.5},
	},
	Logs: []string{
		"[SYS] Obscura Mesh initialized.",
		"[SYS] Secure Enclave status: ACTIVE.",
	},
}

func (s *GlobalState) AddLog(msg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Logs = append(s.Logs, fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), msg))
	if len(s.Logs) > 10 {
		s.Logs = s.Logs[1:]
	}
}

func (s *GlobalState) UpdateStats(latency string, nodes, proofs int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Latency = latency
	s.ActiveNodes = nodes
	s.ZkProofsSec = proofs
}

func (s *GlobalState) UpdatePrice(name, price, status string, trend float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, f := range s.PriceFeeds {
		if f.Name == name {
			s.PriceFeeds[i].Price = price
			s.PriceFeeds[i].Status = status
			s.PriceFeeds[i].Trend = trend
			return
		}
	}
	s.PriceFeeds = append(s.PriceFeeds, Feed{name, price, status, trend})
}

// ... existing methods ...

type Feed struct {
	Name   string  `json:"name"`
	Price  string  `json:"price"`
	Status string  `json:"status"`
	Trend  float64 `json:"trend"`
}

func NewRouter() *mux.Router {
	r := mux.NewRouter()
	r.HandleFunc("/api/stats", getStats).Methods("GET")
	return r
}

func getStats(w http.ResponseWriter, r *http.Request) {
	State.mu.RLock()
	defer State.mu.RUnlock()

	stats := NetworkStats{
		Latency:     State.Latency,
		ActiveNodes: State.ActiveNodes,
		ZkProofsSec: State.ZkProofsSec,
		PriceFeeds:  State.PriceFeeds,
		Logs:        State.Logs,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(stats)
}
