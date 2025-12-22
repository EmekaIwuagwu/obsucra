package automation

import (
	"context"
	"fmt"
	"time"

	"github.com/obscura-network/obscura-node/oracle"
	"github.com/rs/zerolog/log"
)

// Condition defines a trigger condition
type Condition struct {
	Type     string
	Params   map[string]interface{}
	Target   string // Address or callback
}

// TriggerManager handles conditional execution
type TriggerManager struct {
	tasks    []Condition
	jobQueue chan<- oracle.JobRequest // Output channel for triggered jobs
}

// NewTriggerManager creates a new automation manager
func NewTriggerManager(queue chan<- oracle.JobRequest) *TriggerManager {
	return &TriggerManager{
		tasks:    make([]Condition, 0),
		jobQueue: queue,
	}
}

// RegisterTask adds a new automation task
func (tm *TriggerManager) RegisterTask(c Condition) {
	tm.tasks = append(tm.tasks, c)
	log.Info().Str("type", c.Type).Msg("Automation Task Registered")
}

// CheckConditions is the loop that verifies triggers
func (tm *TriggerManager) CheckConditions(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tm.evaluate()
		}
	}
}

func (tm *TriggerManager) evaluate() {
	if len(tm.tasks) == 0 {
		return
	}
	
	log.Debug().Int("tasks", len(tm.tasks)).Msg("Evaluating Automation Conditions")
	
	for _, task := range tm.tasks {
		switch task.Type {
		case "PriceThreshold":
			threshold, _ := task.Params["threshold"].(float64)
			current, _ := task.Params["current"].(float64)
			
			if current >= threshold {
				log.Info().
					Str("target", task.Target).
					Float64("current", current).
					Float64("threshold", threshold).
					Msg("Automation Trigger Fired: Price Threshold Reached")
				
				// Dispatch automated job
				tm.jobQueue <- oracle.JobRequest{
					ID:   fmt.Sprintf("auto-%d", time.Now().Unix()),
					Type: oracle.JobTypeDataFeed,
					Params: map[string]interface{}{
						"url": task.Target,
					},
				}
			}
		}
	}
}
