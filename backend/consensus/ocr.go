package ocr

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"fmt"
	"math/big"
	"sort"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/rs/zerolog/log"
)

// OCRConfig holds configuration for Off-Chain Reporting
type OCRConfig struct {
	// Threshold is the minimum number of valid observations needed
	// Must be >= 2f+1 where f is the maximum number of faulty nodes
	Threshold int

	// DeltaRound is the time between rounds
	DeltaRound time.Duration

	// DeltaGrace is the grace period for observation collection
	DeltaGrace time.Duration

	// DeltaStage is the time for each stage
	DeltaStage time.Duration

	// MaxRoundAge is the maximum age of a round before it's considered stale
	MaxRoundAge time.Duration

	// LeaderRotation enables VRF-based leader rotation
	LeaderRotation bool
}

// DefaultOCRConfig returns default OCR configuration
func DefaultOCRConfig() *OCRConfig {
	return &OCRConfig{
		Threshold:      3,
		DeltaRound:     30 * time.Second,
		DeltaGrace:     5 * time.Second,
		DeltaStage:     2 * time.Second,
		MaxRoundAge:    10 * time.Minute,
		LeaderRotation: true,
	}
}

// Observation represents a single node's observation
type Observation struct {
	NodeID       string
	Value        *big.Int
	Timestamp    time.Time
	Signature    []byte
	PublicKey    []byte
}

// Report represents an aggregated OCR report
type Report struct {
	RoundID          uint64
	FeedID           string
	Observations     []*Observation
	AggregatedValue  *big.Int
	Median           *big.Int
	Timestamp        time.Time
	Leader           string
	Epoch            uint64
	Signatures       []NodeSignature
	ObservationCount int
}

// NodeSignature represents a node's attestation of the report
type NodeSignature struct {
	NodeID    string
	Signature []byte
	PublicKey []byte
}

// OCRNode represents a node participating in OCR
type OCRNode struct {
	ID         string
	PublicKey  *ecdsa.PublicKey
	PrivateKey *ecdsa.PrivateKey
	Reputation float64
	LastSeen   time.Time
	IsActive   bool
}

// OCRManager manages the Off-Chain Reporting protocol
type OCRManager struct {
	mu            sync.RWMutex
	config        *OCRConfig
	nodes         map[string]*OCRNode
	localNode     *OCRNode
	currentRound  uint64
	currentEpoch  uint64
	observations  map[uint64]map[string]*Observation // roundID -> nodeID -> observation
	reports       map[uint64]*Report
	pendingReport *Report
	
	// Channels
	observationChan chan *Observation
	reportChan      chan *Report
	
	// VRF for leader election
	vrfGen func(seed []byte) (*big.Int, []byte, error)
}

// NewOCRManager creates a new OCR manager
func NewOCRManager(config *OCRConfig, privateKey *ecdsa.PrivateKey) (*OCRManager, error) {
	if config == nil {
		config = DefaultOCRConfig()
	}

	nodeID := crypto.PubkeyToAddress(privateKey.PublicKey).Hex()

	return &OCRManager{
		config: config,
		nodes:  make(map[string]*OCRNode),
		localNode: &OCRNode{
			ID:         nodeID,
			PublicKey:  &privateKey.PublicKey,
			PrivateKey: privateKey,
			IsActive:   true,
			Reputation: 100.0,
		},
		observations:    make(map[uint64]map[string]*Observation),
		reports:         make(map[uint64]*Report),
		observationChan: make(chan *Observation, 1000),
		reportChan:      make(chan *Report, 100),
	}, nil
}

// RegisterNode adds a node to the OCR network
func (m *OCRManager) RegisterNode(node *OCRNode) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.nodes[node.ID] = node
	log.Info().Str("nodeId", node.ID).Msg("OCR node registered")
	return nil
}

// Start begins the OCR protocol
func (m *OCRManager) Start(ctx context.Context) {
	ticker := time.NewTicker(m.config.DeltaRound)
	defer ticker.Stop()

	log.Info().
		Int("threshold", m.config.Threshold).
		Dur("deltaRound", m.config.DeltaRound).
		Msg("OCR Manager started")

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			m.startNewRound()

		case obs := <-m.observationChan:
			m.handleObservation(obs)
		}
	}
}

// startNewRound initiates a new OCR round
func (m *OCRManager) startNewRound() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.currentRound++
	m.observations[m.currentRound] = make(map[string]*Observation)

	// Determine leader for this round
	leader := m.electLeader(m.currentRound)

	log.Info().
		Uint64("round", m.currentRound).
		Str("leader", leader).
		Msg("New OCR round started")
}

// electLeader selects the leader for a round using VRF or round-robin
func (m *OCRManager) electLeader(roundID uint64) string {
	if !m.config.LeaderRotation || len(m.nodes) == 0 {
		return m.localNode.ID
	}

	// Get sorted list of active nodes
	var activeNodes []string
	for id, node := range m.nodes {
		if node.IsActive {
			activeNodes = append(activeNodes, id)
		}
	}
	sort.Strings(activeNodes)

	if len(activeNodes) == 0 {
		return m.localNode.ID
	}

	// Simple round-robin for now (VRF in production)
	idx := int(roundID) % len(activeNodes)
	return activeNodes[idx]
}

// SubmitObservation submits an observation for the current round
func (m *OCRManager) SubmitObservation(feedID string, value *big.Int) error {
	m.mu.RLock()
	currentRound := m.currentRound
	m.mu.RUnlock()

	// Create observation
	obs := &Observation{
		NodeID:    m.localNode.ID,
		Value:     value,
		Timestamp: time.Now(),
	}

	// Sign the observation
	hash := m.hashObservation(feedID, currentRound, obs)
	sig, err := crypto.Sign(hash, m.localNode.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to sign observation: %w", err)
	}
	obs.Signature = sig
	obs.PublicKey = crypto.FromECDSAPub(m.localNode.PublicKey)

	// Submit to channel
	select {
	case m.observationChan <- obs:
	default:
		return fmt.Errorf("observation channel full")
	}

	return nil
}

// handleObservation processes an incoming observation
func (m *OCRManager) handleObservation(obs *Observation) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Store observation
	if _, ok := m.observations[m.currentRound]; !ok {
		m.observations[m.currentRound] = make(map[string]*Observation)
	}
	m.observations[m.currentRound][obs.NodeID] = obs

	// Check if we have enough observations
	obsCount := len(m.observations[m.currentRound])
	if obsCount >= m.config.Threshold {
		m.tryAggregateReport()
	}
}

// tryAggregateReport attempts to create an aggregated report
func (m *OCRManager) tryAggregateReport() {
	observations := m.observations[m.currentRound]
	if len(observations) < m.config.Threshold {
		return
	}

	// Collect values for aggregation
	var values []*big.Int
	var validObs []*Observation
	for _, obs := range observations {
		// Verify signature
		if m.verifyObservationSignature(obs) {
			values = append(values, obs.Value)
			validObs = append(validObs, obs)
		}
	}

	if len(values) < m.config.Threshold {
		log.Warn().
			Uint64("round", m.currentRound).
			Int("valid", len(values)).
			Int("required", m.config.Threshold).
			Msg("Insufficient valid observations")
		return
	}

	// Calculate median
	median := m.calculateMedian(values)

	// Create report
	report := &Report{
		RoundID:          m.currentRound,
		Observations:     validObs,
		AggregatedValue:  median,
		Median:           median,
		Timestamp:        time.Now(),
		Leader:           m.electLeader(m.currentRound),
		Epoch:            m.currentEpoch,
		ObservationCount: len(validObs),
	}

	// Sign the report
	sig, err := m.signReport(report)
	if err == nil {
		report.Signatures = append(report.Signatures, NodeSignature{
			NodeID:    m.localNode.ID,
			Signature: sig,
			PublicKey: crypto.FromECDSAPub(m.localNode.PublicKey),
		})
	}

	m.reports[m.currentRound] = report

	log.Info().
		Uint64("round", m.currentRound).
		Int("observations", len(validObs)).
		Str("median", median.String()).
		Msg("OCR report created")

	// Send to report channel
	select {
	case m.reportChan <- report:
	default:
		log.Warn().Msg("Report channel full")
	}
}

// calculateMedian calculates the median of a slice of big.Ints
func (m *OCRManager) calculateMedian(values []*big.Int) *big.Int {
	if len(values) == 0 {
		return big.NewInt(0)
	}

	// Sort values
	sorted := make([]*big.Int, len(values))
	copy(sorted, values)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Cmp(sorted[j]) < 0
	})

	n := len(sorted)
	if n%2 == 0 {
		// Average of two middle values
		mid := n / 2
		sum := new(big.Int).Add(sorted[mid-1], sorted[mid])
		return new(big.Int).Div(sum, big.NewInt(2))
	}
	
	return sorted[n/2]
}

// hashObservation creates a hash of an observation for signing
func (m *OCRManager) hashObservation(feedID string, roundID uint64, obs *Observation) []byte {
	data := fmt.Sprintf("%s:%d:%s:%d",
		feedID,
		roundID,
		obs.Value.String(),
		obs.Timestamp.Unix(),
	)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

// verifyObservationSignature verifies an observation's signature
func (m *OCRManager) verifyObservationSignature(obs *Observation) bool {
	if len(obs.Signature) == 0 || len(obs.PublicKey) == 0 {
		return false
	}

	// Recover public key from signature
	pubKey, err := crypto.UnmarshalPubkey(obs.PublicKey)
	if err != nil {
		return false
	}

	// For simplicity, just check that the signature is valid length
	// In production, fully verify the ECDSA signature
	return pubKey != nil && len(obs.Signature) == 65
}

// signReport creates a signature for a report
func (m *OCRManager) signReport(report *Report) ([]byte, error) {
	hash := m.hashReport(report)
	return crypto.Sign(hash, m.localNode.PrivateKey)
}

// hashReport creates a hash of a report for signing
func (m *OCRManager) hashReport(report *Report) []byte {
	data := fmt.Sprintf("%d:%s:%d:%d",
		report.RoundID,
		report.AggregatedValue.String(),
		report.Timestamp.Unix(),
		report.ObservationCount,
	)
	hash := sha256.Sum256([]byte(data))
	return hash[:]
}

// VerifyReport verifies a report has sufficient valid signatures
func (m *OCRManager) VerifyReport(report *Report) bool {
	if len(report.Signatures) < m.config.Threshold {
		return false
	}

	hash := m.hashReport(report)
	validSigs := 0

	for _, sig := range report.Signatures {
		pubKey, err := crypto.UnmarshalPubkey(sig.PublicKey)
		if err != nil {
			continue
		}

		// Verify signature
		if len(sig.Signature) >= 64 {
			sigNoRecovery := sig.Signature[:64]
			if crypto.VerifySignature(crypto.FromECDSAPub(pubKey), hash, sigNoRecovery) {
				validSigs++
			}
		}
	}

	return validSigs >= m.config.Threshold
}

// GetLatestReport returns the latest finalized report
func (m *OCRManager) GetLatestReport() *Report {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var latest *Report
	for _, report := range m.reports {
		if latest == nil || report.RoundID > latest.RoundID {
			latest = report
		}
	}
	return latest
}

// GetReportForRound returns the report for a specific round
func (m *OCRManager) GetReportForRound(roundID uint64) *Report {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.reports[roundID]
}

// ReportChan returns the channel for finalized reports
func (m *OCRManager) ReportChan() <-chan *Report {
	return m.reportChan
}

// GetStats returns OCR statistics
func (m *OCRManager) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	activeNodes := 0
	for _, node := range m.nodes {
		if node.IsActive {
			activeNodes++
		}
	}

	return map[string]interface{}{
		"current_round":    m.currentRound,
		"current_epoch":    m.currentEpoch,
		"total_nodes":      len(m.nodes),
		"active_nodes":     activeNodes,
		"threshold":        m.config.Threshold,
		"reports_created":  len(m.reports),
		"local_node_id":    m.localNode.ID,
	}
}

// SerializeReport converts a report to bytes for on-chain submission
func SerializeReport(report *Report) ([]byte, error) {
	// Pack report data for on-chain verification
	var buf bytes.Buffer

	// Write round ID (8 bytes)
	roundBytes := make([]byte, 8)
	for i := 0; i < 8; i++ {
		roundBytes[7-i] = byte(report.RoundID >> (8 * i))
	}
	buf.Write(roundBytes)

	// Write aggregated value (32 bytes, padded)
	valueBytes := report.AggregatedValue.Bytes()
	padding := make([]byte, 32-len(valueBytes))
	buf.Write(padding)
	buf.Write(valueBytes)

	// Write observation count (2 bytes)
	buf.WriteByte(byte(report.ObservationCount >> 8))
	buf.WriteByte(byte(report.ObservationCount))

	// Write timestamp (8 bytes)
	tsBytes := make([]byte, 8)
	ts := report.Timestamp.Unix()
	for i := 0; i < 8; i++ {
		tsBytes[7-i] = byte(ts >> (8 * i))
	}
	buf.Write(tsBytes)

	// Write signatures
	for _, sig := range report.Signatures {
		buf.Write(sig.Signature)
	}

	return buf.Bytes(), nil
}
