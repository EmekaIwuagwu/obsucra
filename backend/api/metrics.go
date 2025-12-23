package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/oracle"
)

// JobRecord represents a processed job for the dashboard
type JobRecord struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Target    string    `json:"target"`
	Status    string    `json:"status"`
	Hash      string    `json:"hash"`
	RoundID   uint64    `json:"round_id"`
	Timestamp time.Time `json:"timestamp"`
}

// Proposal represents a governance item
type Proposal struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	VotesFor     int    `json:"votes_for"`
	VotesAgainst int    `json:"votes_against"`
	Status       string `json:"status"`
}

// MetricsCollector tracks node performance metrics
type MetricsCollector struct {
	mu                    sync.RWMutex
	requestsProcessed     uint64
	proofsGenerated       uint64
	transactionsSent      uint64
	transactionsFailed    uint64
	aggregationsCompleted uint64
	outliersDetected      uint64
	uptime                time.Time
	lastRequestTime       time.Time
	oevRecaptured         uint64 // Value in OBS units (e.g., micro-OBS)
	recentJobs            []JobRecord
	proposals             []Proposal
	totalStaked           uint64
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	mc := &MetricsCollector{
		uptime: time.Now(),
	}
	mc.initStaticData()
	return mc
}

func (mc *MetricsCollector) initStaticData() {
	mc.proposals = []Proposal{
		{ID: 1, Title: "OIP-12: Increase Slash Penalty", VotesFor: 65, VotesAgainst: 35, Status: "Active"},
		{ID: 2, Title: "OIP-13: Add Solana Support", VotesFor: 92, VotesAgainst: 8, Status: "Active"},
		{ID: 3, Title: "OIP-14: Reduce Min Stake", VotesFor: 45, VotesAgainst: 55, Status: "Ending Soon"},
	}
	mc.totalStaked = 42800000 // 42.8M base demo stake
}

// IncrementRequestsProcessed increments the requests counter
func (mc *MetricsCollector) IncrementRequestsProcessed() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.requestsProcessed++
	mc.lastRequestTime = time.Now()
}

// IncrementProofsGenerated increments the proofs counter
func (mc *MetricsCollector) IncrementProofsGenerated() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.proofsGenerated++
}

// IncrementTransactionsSent increments the transactions sent counter
func (mc *MetricsCollector) IncrementTransactionsSent() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.transactionsSent++
}

// IncrementTransactionsFailed increments the failed transactions counter
func (mc *MetricsCollector) IncrementTransactionsFailed() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.transactionsFailed++
}

// IncrementAggregationsCompleted increments the aggregations counter
func (mc *MetricsCollector) IncrementAggregationsCompleted() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.aggregationsCompleted++
}

// IncrementOutliersDetected increments the outliers counter
func (mc *MetricsCollector) IncrementOutliersDetected() {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.outliersDetected++
}

// IncrementOEVRecaptured adds to the total OEV recaptured
func (mc *MetricsCollector) IncrementOEVRecaptured(amount uint64) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.oevRecaptured += amount
}

// IncrementTotalStaked adds to the network-wide stake total
func (mc *MetricsCollector) IncrementTotalStaked(amount uint64) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.totalStaked += amount
}

// AddJobRecord adds a job to the recent history
func (mc *MetricsCollector) AddJobRecord(job JobRecord) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	
	mc.recentJobs = append([]JobRecord{job}, mc.recentJobs...)
	if len(mc.recentJobs) > 50 {
		mc.recentJobs = mc.recentJobs[:50]
	}
}

// GetMetrics returns current metrics snapshot
func (mc *MetricsCollector) GetMetrics() map[string]interface{} {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	return map[string]interface{}{
		"requests_processed":     mc.requestsProcessed,
		"proofs_generated":       mc.proofsGenerated,
		"transactions_sent":      mc.transactionsSent,
		"transactions_failed":    mc.transactionsFailed,
		"aggregations_completed": mc.aggregationsCompleted,
		"outliers_detected":      mc.outliersDetected,
		"oev_recaptured":         mc.oevRecaptured,
		"uptime_seconds":         time.Since(mc.uptime).Seconds(),
		"last_request_timestamp": mc.lastRequestTime.Unix(),
		"total_staked":           mc.totalStaked,
	}
}

// GetPrometheusMetrics returns metrics in Prometheus format
func (mc *MetricsCollector) GetPrometheusMetrics() string {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	return fmt.Sprintf(`# HELP obscura_requests_processed_total Total number of oracle requests processed
# TYPE obscura_requests_processed_total counter
obscura_requests_processed_total %d

# HELP obscura_proofs_generated_total Total number of ZK proofs generated
# TYPE obscura_proofs_generated_total counter
obscura_proofs_generated_total %d

# HELP obscura_transactions_sent_total Total number of transactions sent
# TYPE obscura_transactions_sent_total counter
obscura_transactions_sent_total %d

# HELP obscura_transactions_failed_total Total number of failed transactions
# TYPE obscura_transactions_failed_total counter
obscura_transactions_failed_total %d

# HELP obscura_aggregations_completed_total Total number of aggregations completed
# TYPE obscura_aggregations_completed_total counter
obscura_aggregations_completed_total %d

# HELP obscura_outliers_detected_total Total number of outliers detected
# TYPE obscura_outliers_detected_total counter
obscura_outliers_detected_total %d

# HELP obscura_uptime_seconds Node uptime in seconds
# TYPE obscura_uptime_seconds gauge
obscura_uptime_seconds %d
`,
		mc.requestsProcessed,
		mc.proofsGenerated,
		mc.transactionsSent,
		mc.transactionsFailed,
		mc.aggregationsCompleted,
		mc.outliersDetected,
		int64(time.Since(mc.uptime).Seconds()),
	)
}

// MetricsServer serves metrics and health endpoints
type MetricsServer struct {
	collector   *MetricsCollector
	feedManager *oracle.FeedManager
	router      *mux.Router
	port        string
}

// NewMetricsServer creates a new metrics HTTP server
func NewMetricsServer(collector *MetricsCollector, feedManager *oracle.FeedManager, port string) *MetricsServer {
	ms := &MetricsServer{
		collector:   collector,
		feedManager: feedManager,
		router:      mux.NewRouter(),
		port:        port,
	}

	ms.setupRoutes()
	return ms
}

func (ms *MetricsServer) setupRoutes() {
	ms.router.HandleFunc("/health", ms.healthHandler).Methods("GET")
	ms.router.HandleFunc("/metrics", ms.metricsHandler).Methods("GET")
	ms.router.HandleFunc("/api/stats", ms.metricsHandler).Methods("GET") // Alias for SDK
	ms.router.HandleFunc("/api/feeds", ms.feedsHandler).Methods("GET")
	ms.router.HandleFunc("/api/jobs", ms.jobsHandler).Methods("GET")
	ms.router.HandleFunc("/api/proposals", ms.proposalsHandler).Methods("GET")
	ms.router.HandleFunc("/metrics/prometheus", ms.prometheusHandler).Methods("GET")
	
	// Add CORS middleware
	ms.router.Use(ms.corsMiddleware)
}

func (ms *MetricsServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func (ms *MetricsServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
	})
}

func (ms *MetricsServer) metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ms.collector.GetMetrics())
}

func (ms *MetricsServer) prometheusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(ms.collector.GetPrometheusMetrics()))
}

func (ms *MetricsServer) feedsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if ms.feedManager != nil {
		json.NewEncoder(w).Encode(ms.feedManager.GetLiveStatus())
	} else {
		json.NewEncoder(w).Encode([]interface{}{})
	}
}

func (ms *MetricsServer) jobsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ms.collector.mu.RLock()
	defer ms.collector.mu.RUnlock()
	json.NewEncoder(w).Encode(ms.collector.recentJobs)
}

func (ms *MetricsServer) proposalsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ms.collector.mu.RLock()
	defer ms.collector.mu.RUnlock()
	json.NewEncoder(w).Encode(ms.collector.proposals)
}

// Start starts the metrics HTTP server
func (ms *MetricsServer) Start() error {
	log.Info().Str("port", ms.port).Msg("Starting metrics server")
	return http.ListenAndServe(":"+ms.port, ms.router)
}
