package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

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
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		uptime: time.Now(),
	}
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
		"uptime_seconds":         time.Since(mc.uptime).Seconds(),
		"last_request_timestamp": mc.lastRequestTime.Unix(),
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
	collector *MetricsCollector
	router    *mux.Router
	port      string
}

// NewMetricsServer creates a new metrics HTTP server
func NewMetricsServer(collector *MetricsCollector, port string) *MetricsServer {
	ms := &MetricsServer{
		collector: collector,
		router:    mux.NewRouter(),
		port:      port,
	}

	ms.setupRoutes()
	return ms
}

func (ms *MetricsServer) setupRoutes() {
	ms.router.HandleFunc("/health", ms.healthHandler).Methods("GET")
	ms.router.HandleFunc("/metrics", ms.metricsHandler).Methods("GET")
	ms.router.HandleFunc("/metrics/prometheus", ms.prometheusHandler).Methods("GET")
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

// Start starts the metrics HTTP server
func (ms *MetricsServer) Start() error {
	log.Info().Str("port", ms.port).Msg("Starting metrics server")
	return http.ListenAndServe(":"+ms.port, ms.router)
}
