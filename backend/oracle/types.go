package oracle

import "time"

// JobType defines the type of oracle job
type JobType string

const (
	JobTypeDataFeed  JobType = "DATA_FEED"
	JobTypeVRF       JobType = "VRF"
	JobTypeCompute   JobType = "COMPUTE"
)

// JobRequest represents an incoming oracle request
type JobRequest struct {
	ID        string
	Type      JobType
	Params    map[string]interface{}
	Requester string
	Timestamp time.Time
}
