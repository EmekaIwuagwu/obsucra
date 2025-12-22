package node

import (
	"context"
	"fmt"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/oracle"
	"github.com/obscura-network/obscura-node/storage"
)

// ReorgProtector handles blockchain reorganization detection and recovery
type ReorgProtector struct {
	client              *ethclient.Client
	Store               storage.Store
	confirmationDepth   uint64
	lastProcessedBlock  uint64
	lastProcessedHash   common.Hash
	processedEvents     map[string]bool // eventID -> processed
}

// NewReorgProtector creates a new reorg protection manager
func NewReorgProtector(client *ethclient.Client, store storage.Store, confirmationDepth uint64) (*ReorgProtector, error) {
	rp := &ReorgProtector{
		client:            client,
		Store:             store,
		confirmationDepth: confirmationDepth,
		processedEvents:   make(map[string]bool),
	}

	// Load last processed block from storage
	if data, ok := store.GetJob("__last_processed_block"); ok {
		if blockNum, ok := data.(float64); ok {
			rp.lastProcessedBlock = uint64(blockNum)
			log.Info().Uint64("block", rp.lastProcessedBlock).Msg("Loaded last processed block from storage")
		}
	}

	return rp, nil
}

// ShouldProcessEvent checks if an event should be processed (not a reorg duplicate)
func (rp *ReorgProtector) ShouldProcessEvent(blockNumber uint64, txHash common.Hash, logIndex uint) (bool, error) {
	// Create unique event ID
	eventID := fmt.Sprintf("%s-%d", txHash.Hex(), logIndex)

	// Check if already processed
	if rp.processedEvents[eventID] {
		log.Warn().Str("event_id", eventID).Msg("Event already processed, skipping (potential reorg)")
		return false, nil
	}

	// Check confirmation depth
	currentBlock, err := rp.client.BlockNumber(context.Background())
	if err != nil {
		return false, fmt.Errorf("failed to get current block: %w", err)
	}

	if currentBlock < blockNumber+rp.confirmationDepth {
		log.Debug().
			Uint64("event_block", blockNumber).
			Uint64("current_block", currentBlock).
			Uint64("confirmations", currentBlock-blockNumber).
			Msg("Event not yet confirmed, waiting for more blocks")
		return false, nil
	}

	return true, nil
}

// MarkEventProcessed marks an event as successfully processed
func (rp *ReorgProtector) MarkEventProcessed(blockNumber uint64, txHash common.Hash, logIndex uint) error {
	eventID := fmt.Sprintf("%s-%d", txHash.Hex(), logIndex)
	rp.processedEvents[eventID] = true

	// Update last processed block
	if blockNumber > rp.lastProcessedBlock {
		rp.lastProcessedBlock = blockNumber
		if err := rp.Store.SaveJob("__last_processed_block", float64(blockNumber)); err != nil {
			log.Error().Err(err).Msg("Failed to save last processed block")
		}
	}

	// Cleanup old events (keep last 10000 blocks worth)
	if len(rp.processedEvents) > 10000 {
		rp.cleanupOldEvents()
	}

	return nil
}

func (rp *ReorgProtector) cleanupOldEvents() {
	// Simple cleanup: clear half the map
	// In production, use a time-based or block-based cleanup
	count := 0
	for k := range rp.processedEvents {
		delete(rp.processedEvents, k)
		count++
		if count > len(rp.processedEvents)/2 {
			break
		}
	}
	log.Debug().Int("cleaned", count).Msg("Cleaned up old processed events")
}

// GetLastProcessedBlock returns the last successfully processed block number
func (rp *ReorgProtector) GetLastProcessedBlock() uint64 {
	return rp.lastProcessedBlock
}

// JobPersistence handles saving and loading jobs for crash recovery
type JobPersistence struct {
	store storage.Store
}

// NewJobPersistence creates a new job persistence manager
func NewJobPersistence(store storage.Store) *JobPersistence {
	return &JobPersistence{store: store}
}

// SavePendingJob saves a job to persistent storage
func (jp *JobPersistence) SavePendingJob(job oracle.JobRequest) error {
	key := fmt.Sprintf("pending_job_%s", job.ID)
	return jp.store.SaveJob(key, map[string]interface{}{
		"id":        job.ID,
		"type":      string(job.Type),
		"params":    job.Params,
		"requester": job.Requester,
		"timestamp": job.Timestamp.Unix(),
	})
}

// LoadPendingJobs loads all pending jobs from storage
func (jp *JobPersistence) LoadPendingJobs() ([]oracle.JobRequest, error) {
	// This is a simplified implementation
	// In production, you'd iterate through all pending_job_* keys
	var jobs []oracle.JobRequest
	
	// For now, return empty slice
	// The storage interface would need to be extended to support listing keys
	log.Info().Msg("Job persistence: Loading pending jobs (not yet implemented)")
	
	return jobs, nil
}

// MarkJobCompleted removes a job from pending storage
func (jp *JobPersistence) MarkJobCompleted(jobID string) error {
	key := fmt.Sprintf("pending_job_%s", jobID)
	// Storage interface doesn't have delete, so we save a completion marker
	return jp.store.SaveJob(key, map[string]interface{}{
		"completed": true,
		"completed_at": time.Now().Unix(),
	})
}

// RetryQueue manages failed jobs for retry
type RetryQueue struct {
	store        storage.Store
	maxRetries   int
	retryDelay   time.Duration
}

// NewRetryQueue creates a new retry queue manager
func NewRetryQueue(store storage.Store, maxRetries int, retryDelay time.Duration) *RetryQueue {
	return &RetryQueue{
		store:      store,
		maxRetries: maxRetries,
		retryDelay: retryDelay,
	}
}

// AddToRetryQueue adds a failed job to the retry queue
func (rq *RetryQueue) AddToRetryQueue(job oracle.JobRequest, errorMsg string) error {
	key := fmt.Sprintf("retry_job_%s", job.ID)
	
	// Get existing retry count
	var retryCount int
	if data, ok := rq.store.GetJob(key); ok {
		if m, ok := data.(map[string]interface{}); ok {
			if count, ok := m["retry_count"].(float64); ok {
				retryCount = int(count)
			}
		}
	}

	if retryCount >= rq.maxRetries {
		log.Error().
			Str("job_id", job.ID).
			Int("retries", retryCount).
			Msg("Job exceeded max retries, moving to dead letter queue")
		return rq.moveToDeadLetter(job, errorMsg)
	}

	return rq.store.SaveJob(key, map[string]interface{}{
		"id":          job.ID,
		"type":        string(job.Type),
		"params":      job.Params,
		"requester":   job.Requester,
		"retry_count": retryCount + 1,
		"last_error":  errorMsg,
		"next_retry":  time.Now().Add(rq.retryDelay).Unix(),
	})
}

func (rq *RetryQueue) moveToDeadLetter(job oracle.JobRequest, errorMsg string) error {
	key := fmt.Sprintf("dead_letter_%s", job.ID)
	return rq.store.SaveJob(key, map[string]interface{}{
		"id":        job.ID,
		"type":      string(job.Type),
		"params":    job.Params,
		"requester": job.Requester,
		"error":     errorMsg,
		"failed_at": time.Now().Unix(),
	})
}
