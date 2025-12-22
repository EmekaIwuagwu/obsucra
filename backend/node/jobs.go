package node

import (
	"context"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/adapters"
	"github.com/obscura-network/obscura-node/security"
	"github.com/obscura-network/obscura-node/vrf"
	"github.com/obscura-network/obscura-node/zkp"
)

// JobType defines the type of oracle job
type JobType string

const (
	JobTypeDataFeed  JobType = "DATA_FEED"
	JobTypeVRF       JobType = "VRF"
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
	jobQueue    chan JobRequest
	mu          sync.RWMutex
	adapters    *adapters.AdapterManager
	txMgr       *TxManager
	vrfMgr      *vrf.RandomnessManager
	repMgr      *security.ReputationManager
	oracleAddr  common.Address
	oracleABI   abi.ABI
}

const OracleWriteABI = `[
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256[8]","name":"zkpProof","type":"uint256[8]"},{"internalType":"uint256[2]","name":"publicInputs","type":"uint256[2]"}],"name":"fulfillData","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"randomness","type":"uint256"},{"internalType":"bytes","name":"proof","type":"bytes"}],"name":"fulfillRandomness","outputs":[],"stateMutability":"nonpayable","type":"function"}
]`

// NewJobManager creates a new JobManager
func NewJobManager(am *adapters.AdapterManager, txMgr *TxManager, vrfMgr *vrf.RandomnessManager, repMgr *security.ReputationManager, contractAddr string) (*JobManager, error) {
	parsed, err := abi.JSON(strings.NewReader(OracleWriteABI))
	if err != nil {
		return nil, err
	}

	return &JobManager{
		jobQueue:   make(chan JobRequest, 100),
		adapters:   am,
		txMgr:      txMgr,
		vrfMgr:     vrfMgr,
		repMgr:     repMgr,
		oracleAddr: common.HexToAddress(contractAddr),
		oracleABI:  parsed,
	}, nil
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
	
	// Ensure ZKP system is ready
	if err := zkp.Init(); err != nil {
		log.Error().Err(err).Msg("Failed to initialize ZKP system. ZK proofs will fail.")
	}

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Job Manager stopping")
			return
		case job := <-jm.jobQueue:
			go jm.processJob(ctx, job) // Process in goroutine for concurrency
		}
	}
}

func (jm *JobManager) processJob(ctx context.Context, job JobRequest) {
	log.Info().Str("job_id", job.ID).Msg("Processing job")
	
	switch job.Type {
	case JobTypeDataFeed:
		jm.handleDataFeed(ctx, job)
	case JobTypeVRF:
		jm.handleVRF(ctx, job)
	default:
		log.Warn().Str("type", string(job.Type)).Msg("Unknown job type")
	}
}

func (jm *JobManager) handleDataFeed(ctx context.Context, job JobRequest) {
	// 1. Fetch Data
	url, _ := job.Params["url"].(string)
	
	req := adapters.FetchDataRequest{
		URL:      url,
		Method:   "GET",
		Path:     "price", 
		Obscured: false,
	}

	result, err := jm.adapters.Fetch(req)
	if err != nil {
		log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to fetch external data")
		jm.repMgr.UpdateReputation("self", -1.0) // Local penalty
		return
	}

	log.Info().Interface("result", result).Msg("Data Fetched")

	valFloat, ok := result.(float64)
	if !ok {
		log.Error().Msg("Result is not a float number")
		return 
	}
	
	valueBig := new(big.Int).SetInt64(int64(valFloat * 100)) 
	
	// 2. Generate ZKP
	minBin, _ := job.Params["min"].(*big.Int)
	maxBin, _ := job.Params["max"].(*big.Int)
	if minBin == nil { minBin = big.NewInt(0) }
	if maxBin == nil { maxBin = new(big.Int).Set(valueBig).Add(valueBig, big.NewInt(1000)) }

	proof, err := zkp.GenerateProof(valueBig, minBin, maxBin)
	if err != nil {
		log.Error().Err(err).Msg("ZKP Generation failed")
		return
	}

	serializedProof, err := zkp.SerializeProof(proof)
	if err != nil {
		log.Error().Err(err).Msg("ZKP Serialization failed")
		return
	}

	// Public inputs: Min, Max
	pubInputs := [2]*big.Int{minBin, maxBin}
	
	// 3. Submit Transaction
	jm.submitFulfillment(ctx, job.ID, valueBig, serializedProof, pubInputs)
}

func (jm *JobManager) submitFulfillment(ctx context.Context, jobIDStr string, value *big.Int, proof [8]*big.Int, pubInputs [2]*big.Int) {
	// Parse ID
	reqID := new(big.Int)
	reqID.SetString(jobIDStr, 10)

	// Pack Data
	data, err := jm.oracleABI.Pack("fulfillData", reqID, value, proof, pubInputs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to pack ABI")
		return
	}

	txHash, err := jm.txMgr.SendTransaction(ctx, jm.oracleAddr, data, big.NewInt(0))
	if err != nil {
		log.Error().Err(err).Msg("Failed to send fulfillment transaction")
		return
	}

	log.Info().Str("tx_hash", txHash.Hex()).Msg("Fulfillment Transaction Sent")
}

func (jm *JobManager) handleVRF(ctx context.Context, job JobRequest) {
	seed, _ := job.Params["seed"].(string)
	
	valStr, proofStr, err := jm.vrfMgr.GenerateRandomness(seed)
	if err != nil {
		log.Error().Err(err).Msg("VRF Generation failed")
		return
	}

	randomValue := new(big.Int)
	randomValue.SetString(valStr, 10)
	
	// Convert proof hex to bytes
	// Note: job.ID is the string decimal ID
	reqID := new(big.Int)
	reqID.SetString(job.ID, 10)

	data, err := jm.oracleABI.Pack("fulfillRandomness", reqID, randomValue, []byte(proofStr))
	if err != nil {
		log.Error().Err(err).Msg("Failed to pack fulfillRandomness")
		return
	}

	txHash, err := jm.txMgr.SendTransaction(ctx, jm.oracleAddr, data, big.NewInt(0))
	if err != nil {
		log.Error().Err(err).Msg("Failed to send VRF fulfillment")
		return
	}

	log.Info().Str("tx_hash", txHash.Hex()).Msg("VRF Fulfillment Sent")
}
