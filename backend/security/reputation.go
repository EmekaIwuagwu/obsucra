package security

import (
	"sync"

	"github.com/rs/zerolog/log"
)

// ReputationManager tracks the performance and honesty of nodes
type ReputationManager struct {
	scores map[string]float64 // NodeID -> Score (0-100)
	mu     sync.RWMutex
}

// NewReputationManager initializes the manager
func NewReputationManager() *ReputationManager {
	return &ReputationManager{
		scores: make(map[string]float64),
	}
}

// UpdateReputation adjusts a node's reputation by a specific delta
func (rm *ReputationManager) UpdateReputation(nodeID string, delta float64) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	current, exists := rm.scores[nodeID]
	if !exists {
		current = 50.0
	}

	current += delta
	if current > 100.0 {
		current = 100.0
	}
	if current < 0.0 {
		current = 0.0
	}

	rm.scores[nodeID] = current
	log.Debug().Str("node_id", nodeID).Float64("new_score", current).Float64("delta", delta).Msg("Reputation adjusted")
}

// GetScore returns the current score of a node
func (rm *ReputationManager) GetScore(nodeID string) float64 {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	
	if score, ok := rm.scores[nodeID]; ok {
		return score
	}
	return 50.0 // Default for unknown
}

// IsTrusted checks if a node is above a certain threshold
func (rm *ReputationManager) IsTrusted(nodeID string) bool {
	return rm.GetScore(nodeID) > 80.0
}

// SlashCandidate identifies if a node should be slashed
func (rm *ReputationManager) SlashCandidate(nodeID string) bool {
	return rm.GetScore(nodeID) < 20.0
}
