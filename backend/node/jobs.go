package node

import (
	"context"
	"math/big"
	"sort"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

// JobType defines the type of oracle job
type JobType string

const (
	JobTypeDataFeed  JobType = "DATA_FEED"
	JobTypeVRF       JobType = "VRF"
	JobTypeCompute   JobType = "COMPUTE"
	JobTypePredicate JobType = "PREDICATE"
)

// JobRequest represents an incoming oracle request
type JobRequest struct {
	ID        string
	Type      JobType
	Params    map[string]interface{}
	Requester string
	Timestamp time.Time
}

// JobManager handles the lifecycle of jobs
type JobManager struct {
	jobQueue chan JobRequest
	mu       sync.RWMutex
}

// NewJobManager creates a new JobManager
func NewJobManager() *JobManager {
	return &JobManager{
		jobQueue: make(chan JobRequest, 100),
	}
}

// SubmitJob adds a job to the processing queue
func (jm *JobManager) SubmitJob(job JobRequest) {
	jm.mu.Lock()
	defer jm.mu.Unlock()
	jm.jobQueue <- job
	log.Info().Str("job_id", job.ID).Str("type", string(job.Type)).Msg("Job submitted")
}

// Start begins processing jobs from the queue
func (jm *JobManager) Start(ctx context.Context) {
	log.Info().Msg("Job Manager started")
	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Job Manager stopping")
			return
		case job := <-jm.jobQueue:
			jm.processJob(job)
		}
	}
}

func (jm *JobManager) processJob(job JobRequest) {
	log.Info().Str("job_id", job.ID).Msg("Processing job")
	
	// Simulate processing time
	time.Sleep(100 * time.Millisecond)

	switch job.Type {
	case JobTypeDataFeed:
		jm.handleDataFeed(job)
	case JobTypeVRF:
		jm.handleVRF(job)
	default:
		log.Warn().Str("type", string(job.Type)).Msg("Unknown job type")
	}
}

func (jm *JobManager) handleDataFeed(job JobRequest) {
	// Logic to fetch external data (via adapters) and aggregate
	// For now, we simulate aggregation
	results := []float64{100.2, 100.5, 99.8, 101.0, 100.3}
	median := CalculateMedian(results)
	log.Info().Str("job_id", job.ID).Float64("median", median).Msg("Data Feed Aggregated")
	
	// TODO: Generate ZKP for the result (Privacy Mode)
}

func (jm *JobManager) handleVRF(job JobRequest) {
	// Logic for VRF
	log.Info().Str("job_id", job.ID).Msg("VRF Request Processed")
}

// CalculateMedian is a utility to find the median of a slice of floats
func CalculateMedian(values []float64) float64 {
	sort.Float64s(values)
	n := len(values)
	if n == 0 {
		return 0
	}
	if n%2 == 1 {
		return values[n/2]
	}
	return (values[n/2-1] + values[n/2]) / 2.0
}

// AggregateZKP would interface with gnark to produce a proof of aggregation
func AggregateZKP(inputs []big.Int) ([]byte, error) {
	// Placeholder for ZK Aggregation logic using gnark
	// In a real implementation, this would compile/load the circuit and prove it
	return []byte("mock_zk_proof"), nil
}
