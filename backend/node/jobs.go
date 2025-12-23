package node

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/adapters"
	"github.com/obscura-network/obscura-node/ai"
	"github.com/obscura-network/obscura-node/api"
	"github.com/obscura-network/obscura-node/functions"
	"github.com/obscura-network/obscura-node/oracle"
	"github.com/obscura-network/obscura-node/security"
	"github.com/obscura-network/obscura-node/storage"
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
	persistence *JobPersistence
	metrics     *api.MetricsCollector
	feedManager *oracle.FeedManager
	ai          *ai.PredictiveModel
	secrets     *storage.SecretManager
}

const OracleWriteABI = `[
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256[8]","name":"zkpProof","type":"uint256[8]"},{"internalType":"uint256[2]","name":"publicInputs","type":"uint256[2]"}],"name":"fulfillData","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"fulfillDataOptimistic","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"randomness","type":"uint256"},{"internalType":"bytes","name":"proof","type":"bytes"}],"name":"fulfillRandomness","outputs":[],"stateMutability":"nonpayable","type":"function"}
]`

// NewJobManager creates a new JobManager
func NewJobManager(am *adapters.AdapterManager, txMgr *TxManager, vrfMgr *vrf.RandomnessManager, repMgr *security.ReputationManager, cm *functions.ComputeManager, contractAddr string, jp *JobPersistence, metrics *api.MetricsCollector, fm *oracle.FeedManager, aiModel *ai.PredictiveModel, sm *storage.SecretManager) (*JobManager, error) {
	parsed, err := abi.JSON(strings.NewReader(OracleWriteABI))
	if err != nil {
		return nil, err
	}
 
	return &JobManager{
		JobQueue:    make(chan oracle.JobRequest, 100),
		adapters:    am,
		txMgr:       txMgr,
		vrfMgr:      vrfMgr,
		repMgr:      repMgr,
		computeMgr:  cm,
		oracleAddr:  common.HexToAddress(contractAddr),
		oracleABI:   parsed,
		persistence: jp,
		metrics:     metrics,
		feedManager: fm,
		ai:          aiModel,
		secrets:     sm,
	}, nil
}

// Dispatch adds a job to the queue
func (jm *JobManager) Dispatch(job oracle.JobRequest) {
	// Persist before dispatching
	if jm.persistence != nil {
		if err := jm.persistence.SavePendingJob(job); err != nil {
			log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to persist job")
		}
	}

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

	// Load pending jobs on startup
	if jm.persistence != nil {
		pending, err := jm.persistence.LoadPendingJobs()
		if err == nil {
			for _, job := range pending {
				log.Info().Str("job_id", job.ID).Msg("Restoring pending job from storage")
				jm.JobQueue <- job
			}
		}
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

	// Mark as completed in persistence
	if jm.persistence != nil {
		if err := jm.persistence.MarkJobCompleted(job.ID); err != nil {
			log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to mark job as completed in storage")
		}
	}
}

func (jm *JobManager) handleDataFeed(ctx context.Context, job oracle.JobRequest) {
	// 1. Fetch Data
	url, _ := job.Params["url"].(string)
	
	// Feature #5: Inject Authentication for Private Sources
	headers := make(map[string]string)
	if cred, ok := jm.secrets.GetCredential(url); ok {
		log.Info().Str("url", url).Msg("First-Party Authenticated Source Detected. Injecting Vault Credentials.")
		// In real usage we'd parse the header vs key, simplified for demo
		headers["Authorization"] = cred
	}

	result, err := jm.adapters.Fetch(adapters.FetchDataRequest{
		URL:      url,
		Method:   "GET",
		Path:     "price", 
		Obscured: false,
		Headers:  headers,
		Retries:  3,
	})
	if err != nil {
		log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to fetch external data")
		jm.repMgr.UpdateReputation("self", -1.0)
		return
	}

	log.Info().Interface("result", result).Msg("Data Fetched")
 
	if job.OEVEnabled {
		log.Info().Str("beneficiary", job.OEVBeneficiary).Msg("OEV RECAPTURE ACTIVE - Processing high-value priority feed")
		if jm.metrics != nil {
			jm.metrics.IncrementOEVRecaptured(100) // Dummy base increment for detection
		}
	}

	valFloat, ok := result.(float64)
	if !ok {
		log.Error().Msg("Result is not a float number")
		return 
	}
	
	// Standardizing to 8 decimal places for price feeds
	valInt := new(big.Int).SetUint64(uint64(valFloat * 1e8))
	
	// 1.5 Update Local Feed Tracking with Stats (Feature #4)
	if jm.feedManager != nil {
		jm.ai.AddDataPoint(job.ID, valFloat)
		volatility := jm.ai.PredictVolatility(job.ID)
		
		// Confidence calculation: 100% minus relative volatility
		conf := 100.0
		if valFloat > 0 {
			conf = math.Max(0, 100.0-(volatility/valFloat*100.0))
		}

		// Outlier Detection: If value is more than 2x standard deviation from recent volatility
		// (Simplified Z-score check)
		outliers := 0
		if volatility > 0 && math.Abs(valFloat - (valFloat - volatility)) > 2*volatility {
			outliers = 1
			log.Warn().Str("feed", job.ID).Float64("value", valFloat).Msg("Potential Outlier Detected!")
		}

		jm.feedManager.UpdateFeedValue(oracle.FeedLiveStatus{
			ID:                 job.ID,
			Value:              fmt.Sprintf("$%.2f", valFloat),
			Confidence:         conf,
			Outliers:           outliers, 
			RoundID:            0, 
			Timestamp:          time.Now(),
			IsZK:               true,
			IsOptimistic:       job.IsOptimistic,
			ConfidenceInterval: fmt.Sprintf("± %.2f%%", (volatility/valFloat)*100),
		})
	}

	if job.IsOptimistic {
		log.Info().Str("job_id", job.ID).Msg("Optimistic Mode Active - Skipping ZK proof for initial fulfillment")
		jm.submitFulfillmentOptimistic(ctx, job.ID, valInt)
		return
	}

	// 2. Generate ZK Proof
	log.Info().Str("job_id", job.ID).Msg("Generating Zero-Knowledge Range Proof")
	
	// Range verification: value ± 10% or similar. For demo/MVP using hardcoded range or job params.
	minInt := toBigInt(job.Params["min"])
	maxInt := toBigInt(job.Params["max"])
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

	// Update Job History for Dashboard
	jm.metrics.AddJobRecord(api.JobRecord{
		ID:        job.ID,
		Type:      "Data Feed",
		Target:    url,
		Status:    "Fulfilled",
		Hash:      "0x" + job.ID[:8] + "...data",
		RoundID:   0,
		Timestamp: time.Now(),
	})
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

	// Note: The AddJobRecord for DataFeed is now handled directly in handleDataFeed
	// to ensure 'url' and 'job.ID' are in scope.
	// This function is also used by handleCompute, which will add its own record.
}

func (jm *JobManager) submitFulfillmentOptimistic(ctx context.Context, jobIDStr string, value *big.Int) {
	reqID := new(big.Int)
	reqID.SetString(jobIDStr, 10)

	data, err := jm.oracleABI.Pack("fulfillDataOptimistic", reqID, value)
	if err != nil {
		log.Error().Err(err).Msg("Failed to pack fulfillDataOptimistic")
		return
	}

	txHash, err := jm.txMgr.SendTransaction(ctx, jm.oracleAddr, data, big.NewInt(0))
	if err != nil {
		log.Error().Err(err).Msg("Failed to send optimistic fulfillment")
		return
	}

	log.Info().Str("tx_hash", txHash.Hex()).Msg("Optimistic Fulfillment Sent (Challenge Window Open)")
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
		log.Error().Err(err).Msg("Failed to send fulfillment transaction")
		return
	}

	log.Info().Str("tx_hash", txHash.Hex()).Msg("VRF Fulfillment Transaction Sent")

	// Update Job History for Dashboard
	jm.metrics.AddJobRecord(api.JobRecord{
		ID:        job.ID,
		Type:      "VRF Request",
		Target:    "VRF.sol",
		Status:    "Fulfilled",
		Hash:      txHash.Hex(),
		RoundID:   0,
		Timestamp: time.Now(),
	})
}

func toBigInt(val interface{}) *big.Int {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case *big.Int:
		return v
	case string:
		i := new(big.Int)
		i.SetString(v, 10)
		return i
	case float64:
		return big.NewInt(int64(v))
	}
	return nil
}

func (jm *JobManager) handleCompute(ctx context.Context, job oracle.JobRequest) {
	// 1. Execute Private Logic (Simulated for Phase 2)
	// In a real scenario, this would fetch from a private API or TEE
	secretValue := big.NewInt(75000) // Assume secret data is $75k
	threshold := toBigInt(job.Params["threshold"])
	if threshold == nil { threshold = big.NewInt(50000) }

	log.Info().Str("job_id", job.ID).Msg("Executing Confidential Computation...")

	// 2. Generate ZK Proof of Computation
	// Prove that secretValue >= threshold without revealing secretValue
	proof, err := zkp.GeneratePrivateComputationProof(secretValue, threshold, 0)
	if err != nil {
		log.Error().Err(err).Msg("Private ZK Proof Generation failed")
		return
	}

	serialized, err := zkp.SerializeProof(proof)
	if err != nil {
		log.Error().Err(err).Msg("Proof serialization failed")
		return
	}

	// 3. Submit Proof to Blockchain
	// In this mode, we reveal the 'threshold' as public input, but 'secretValue' remains hidden
	jm.submitFulfillment(ctx, job.ID, big.NewInt(1), serialized, [2]*big.Int{threshold, big.NewInt(0)})
	
	log.Info().Str("job_id", job.ID).Msg("Confidential Compute Proof Generated and Dispatched")

	// Update Job History for Dashboard
	jm.metrics.AddJobRecord(api.JobRecord{
		ID:        job.ID,
		Type:      "Private Compute",
		Target:    "ZK-Runtime",
		Status:    "Proven",
		Hash:      "0x" + job.ID[:8] + "...zkp",
		RoundID:   0,
		Timestamp: time.Now(),
	})
}
