package node

import (
	"context"
	"math/big"
	"time"

	"github.com/rs/zerolog/log"
)

// EventListener monitors the blockchain for Oracle events
type EventListener struct {
	JobManager *JobManager
	RPCEndpoint string
}

// NewEventListener creates a new listener
func NewEventListener(jm *JobManager, rpc string) *EventListener {
	return &EventListener{
		JobManager: jm,
		RPCEndpoint: rpc,
	}
}

// Start begins polling for events (Mock implementation for prototype)
// In production: Use ethclient.SubscribeFilterLogs
func (el *EventListener) Start(ctx context.Context) {
	log.Info().Msg("Blockchain Event Listener Started")

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Event Listener stopping")
			return
		case <-ticker.C:
			el.pollEvents()
		}
	}
}

func (el *EventListener) pollEvents() {
	// MOCK: Simulate catching an event periodically
	// In real impl: fetch logs from eth_getLogs
	
	// Simulate Data Request
	// log.Debug().Msg("Polling for new events...")
	
	// Occasionally generate a mock job for demonstration if queue is empty
	// This keeps the dashboard "alive" during demos
	/*
	jobID := fmt.Sprintf("req-%d", time.Now().Unix())
	el.JobManager.SubmitJob(JobRequest{
		ID: jobID,
		Type: JobTypeDataFeed,
		Params: map[string]interface{}{"pair": "ETH/USD"},
		Requester: "0xMockRequester",
		Timestamp: time.Now(),
	})
	*/
}

// MockEventTrigger is used by tests/demo scripts to manually invoke the listener
func (el *EventListener) MockEventTrigger(jobType JobType, params map[string]interface{}) {
	el.JobManager.SubmitJob(JobRequest{
		ID:        "mock-" + big.NewInt(time.Now().UnixNano()).String(),
		Type:      jobType,
		Params:    params,
		Requester: "0x0000000000000000000000000000000000000000",
		Timestamp: time.Now(),
	})
}
