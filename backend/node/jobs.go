package node

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/adapters"
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
	client      *ethclient.Client
	privateKey  *ecdsa.PrivateKey
	oracleAddr  common.Address
	oracleABI   abi.ABI
}

const OracleWriteABI = `[{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256[8]","name":"zkpProof","type":"uint256[8]"},{"internalType":"uint256[2]","name":"publicInputs","type":"uint256[2]"}],"name":"fulfillData","outputs":[],"stateMutability":"nonpayable","type":"function"}]`

// NewJobManager creates a new JobManager
func NewJobManager(am *adapters.AdapterManager, client *ethclient.Client, pkHex, contractAddr string) (*JobManager, error) {
	pk, err := crypto.HexToECDSA(pkHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	parsed, err := abi.JSON(strings.NewReader(OracleWriteABI))
	if err != nil {
		return nil, err
	}

	return &JobManager{
		jobQueue:   make(chan JobRequest, 100),
		adapters:   am,
		client:     client,
		privateKey: pk,
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
		log.Warn().Msg("VRF not yet fully implemented in JobManager")
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

	// Prepare Tx
	nonce, err := jm.client.PendingNonceAt(ctx, crypto.PubkeyToAddress(jm.privateKey.PublicKey))
	if err != nil {
		log.Error().Err(err).Msg("Failed to get nonce")
		return
	}

	gasPrice, err := jm.client.SuggestGasPrice(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get gas price")
		return
	}

	auth, err := jm.client.ChainID(ctx)
	if err != nil { return }
	
	// Pack Data
	data, err := jm.oracleABI.Pack("fulfillData", reqID, value, proof, pubInputs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to pack ABI")
		return
	}

	tx := types.NewTransaction(nonce, jm.oracleAddr, big.NewInt(0), 500000, gasPrice, data)
	
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(auth), jm.privateKey)
	if err != nil {
		log.Error().Err(err).Msg("Failed to sign tx")
		return
	}

	err = jm.client.SendTransaction(ctx, signedTx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send transaction")
		return
	}

	log.Info().Str("tx_hash", signedTx.Hash().Hex()).Msg("Fulfillment Transaction Sent")
}
