package node

import (
	"context"
	"math/big"
	"strings"
	"sync"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/adapters"
	"github.com/obscura-network/obscura-node/functions"
	"github.com/obscura-network/obscura-node/oracle"
	"github.com/obscura-network/obscura-node/security"
	"github.com/obscura-network/obscura-node/vrf"
	"github.com/obscura-network/obscura-node/zkp"
)

// JobManager handles the lifecycle of jobs
type JobManager struct {
	JobQueue    chan oracle.JobRequest
	mu          sync.RWMutex
	adapters    *adapters.AdapterManager
	txMgr       *TxManager
	vrfMgr      *vrf.RandomnessManager
	repMgr      *security.ReputationManager
	computeMgr  *functions.ComputeManager
	oracleAddr  common.Address
	oracleABI   abi.ABI
}

const OracleWriteABI = `[
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256[8]","name":"zkpProof","type":"uint256[8]"},{"internalType":"uint256[2]","name":"publicInputs","type":"uint256[2]"}],"name":"fulfillData","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"randomness","type":"uint256"},{"internalType":"bytes","name":"proof","type":"bytes"}],"name":"fulfillRandomness","outputs":[],"stateMutability":"nonpayable","type":"function"}
]`

// NewJobManager creates a new JobManager
func NewJobManager(am *adapters.AdapterManager, txMgr *TxManager, vrfMgr *vrf.RandomnessManager, repMgr *security.ReputationManager, cm *functions.ComputeManager, contractAddr string) (*JobManager, error) {
	parsed, err := abi.JSON(strings.NewReader(OracleWriteABI))
	if err != nil {
		return nil, err
	}

	return &JobManager{
		JobQueue:   make(chan oracle.JobRequest, 100),
		adapters:   am,
		txMgr:      txMgr,
		vrfMgr:     vrfMgr,
		repMgr:     repMgr,
		computeMgr: cm,
		oracleAddr: common.HexToAddress(contractAddr),
		oracleABI:  parsed,
	}, nil
}

// Dispatch adds a job to the queue
func (jm *JobManager) Dispatch(job oracle.JobRequest) {
	jm.JobQueue <- job
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
		case job := <-jm.JobQueue:
			go jm.processJob(ctx, job) // Process in goroutine for concurrency
		}
	}
}

func (jm *JobManager) processJob(ctx context.Context, job oracle.JobRequest) {
	log.Info().Str("job_id", job.ID).Str("type", string(job.Type)).Msg("Processing Job")
	
	switch job.Type {
	case oracle.JobTypeDataFeed:
		jm.handleDataFeed(ctx, job)
	case oracle.JobTypeVRF:
		jm.handleVRF(ctx, job)
	case oracle.JobTypeCompute:
		jm.handleCompute(ctx, job)
	default:
		log.Warn().Str("type", string(job.Type)).Msg("Unknown job type")
	}
}

func (jm *JobManager) handleDataFeed(ctx context.Context, job oracle.JobRequest) {
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
		jm.repMgr.UpdateReputation("self", -1.0)
		return
	}

	log.Info().Interface("result", result).Msg("Data Fetched")

	valFloat, ok := result.(float64)
	if !ok {
		log.Error().Msg("Result is not a float number")
		return 
	}
	
	// Standardizing to 8 decimal places for price feeds
	valInt := new(big.Int).SetUint64(uint64(valFloat * 1e8))
	
	// 2. Generate ZK Proof
	log.Info().Str("job_id", job.ID).Msg("Generating Zero-Knowledge Range Proof")
	
	// Range verification: value ± 10% or similar. For demo/MVP using hardcoded range or job params.
	minInt, _ := job.Params["min"].(*big.Int)
	maxInt, _ := job.Params["max"].(*big.Int)
	if minInt == nil { minInt = new(big.Int).Sub(valInt, big.NewInt(1000000)) }
	if maxInt == nil { maxInt = new(big.Int).Add(valInt, big.NewInt(1000000)) }

	proof, err := zkp.GenerateRangeProof(valInt, minInt, maxInt)
	if err != nil {
		log.Error().Err(err).Msg("ZK Proof Generation failed")
		return
	}

	serialized, err := zkp.SerializeProof(proof)
	if err != nil {
		log.Error().Err(err).Msg("Proof serialization failed")
		return
	}

	// 3. Submit to Blockchain
	jm.submitFulfillment(ctx, job.ID, valInt, serialized, [2]*big.Int{minInt, maxInt})
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

func (jm *JobManager) handleVRF(ctx context.Context, job oracle.JobRequest) {
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

func (jm *JobManager) handleCompute(ctx context.Context, job oracle.JobRequest) {
	wasmBytes, _ := job.Params["wasm"].([]byte)
	funcName, _ := job.Params["function"].(string)
	
	// Execute WASM
	results, err := jm.computeMgr.ExecuteWasm(ctx, wasmBytes, funcName, nil)
	if err != nil {
		log.Error().Err(err).Msg("WASM Execution failed")
		return
	}

	if len(results) == 0 {
		log.Error().Msg("WASM execution returned no results")
		return
	}

	valInt := new(big.Int).SetUint64(results[0])
	
	// For compute, we might skip ZK or use a specialized circuit. 
	// For now, simple fulfillment.
	jm.submitFulfillment(ctx, job.ID, valInt, [8]*big.Int{}, [2]*big.Int{})
}
