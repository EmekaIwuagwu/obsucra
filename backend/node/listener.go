package node

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/oracle"
)

// EventListener monitors the blockchain for Oracle events
type EventListener struct {
	JobManager     *JobManager
	RPCEndpoint    string
	ContractAddr   common.Address
	client         *ethclient.Client
	oracleABI      abi.ABI
	reorgProtector *ReorgProtector
}

// Hardcoded ABI for Event Parsing (Partial)
const OracleEventABI = `[
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"requestId","type":"uint256"},{"indexed":false,"internalType":"string","name":"apiUrl","type":"string"},{"indexed":false,"internalType":"uint256","name":"min","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"max","type":"uint256"},{"indexed":true,"internalType":"address","name":"requester","type":"address"},{"indexed":false,"internalType":"bool","name":"oevEnabled","type":"bool"},{"indexed":false,"internalType":"address","name":"oevBeneficiary","type":"address"},{"indexed":false,"internalType":"bool","name":"isOptimistic","type":"bool"}],"name":"RequestData","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"requestId","type":"uint256"},{"indexed":false,"internalType":"string","name":"seed","type":"string"},{"indexed":true,"internalType":"address","name":"requester","type":"address"}],"name":"RandomnessRequested","type":"event"}
]`

// NewEventListener creates a new listener
func NewEventListener(jm *JobManager, rpc string, contractAddr string, rp *ReorgProtector) (*EventListener, error) {
	parsedABI, err := abi.JSON(strings.NewReader(OracleEventABI))
	if err != nil {
		return nil, err
	}
	
	return &EventListener{
		JobManager:     jm,
		RPCEndpoint:    rpc,
		ContractAddr:   common.HexToAddress(contractAddr),
		oracleABI:      parsedABI,
		reorgProtector: rp,
	}, nil
}

// Start begins subscribing to blockchain events with automatic reconnection
func (el *EventListener) Start(ctx context.Context) {
	for {
		err := el.connectAndListen(ctx)
		if err != nil {
			log.Error().Err(err).Msg("EventListener error, reconnecting in 10s...")
		}
		
		select {
		case <-ctx.Done():
			return
		case <-time.After(10 * time.Second):
			continue
		}
	}
}

func (el *EventListener) connectAndListen(ctx context.Context) error {
	log.Debug().Str("rpc", el.RPCEndpoint).Msg("Connecting to Blockchain...")

	client, err := ethclient.Dial(el.RPCEndpoint)
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}
	defer client.Close()
	el.client = client

	query := ethereum.FilterQuery{
		Addresses: []common.Address{el.ContractAddr},
	}

	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("failed to subscribe: %w", err)
	}
	defer sub.Unsubscribe()

	log.Info().Msg("Event subscription active")

	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-sub.Err():
			return fmt.Errorf("subscription interrupted: %w", err)
		case vLog := <-logs:
			el.handleLog(vLog)
		}
	}
}

func (el *EventListener) handleLog(vLog types.Log) {
	// Check reorg protection if available
	if el.reorgProtector != nil {
		shouldProcess, err := el.reorgProtector.ShouldProcessEvent(
			vLog.BlockNumber,
			vLog.TxHash,
			vLog.Index,
		)
		if err != nil {
			log.Error().Err(err).Msg("Reorg check failed")
			return
		}
		if !shouldProcess {
			return // Skip duplicate or unconfirmed event
		}
	}
	
	event, err := el.oracleABI.EventByID(vLog.Topics[0])
	if err != nil {
		return // Not our event
	}

	switch event.Name {
	case "RequestData":
		// requestId := new(big.Int).SetBytes(vLog.Topics[1].Bytes()) // Not used in new logic
		requester := common.BytesToAddress(vLog.Topics[2].Bytes())

		vals, err := el.oracleABI.Unpack("RequestData", vLog.Data)
		if err != nil {
			log.Error().Err(err).Msg("Failed to unpack RequestData")
			return
		}
		
		id := vals[0].(*big.Int).String()
		url := vals[1].(string)
		min := vals[2].(*big.Int)
		max := vals[3].(*big.Int)
		oevEnabled := vals[4].(bool)
		oevBeneficiary := vals[5].(common.Address)
		isOptimistic := vals[6].(bool)
		
		el.JobManager.Dispatch(oracle.JobRequest{
			ID:             id,
			Type:           oracle.JobTypeDataFeed,
			Params:         map[string]interface{}{"url": url, "min": min, "max": max},
			Requester:      requester.Hex(),
			Timestamp:      time.Now(),
			OEVEnabled:     oevEnabled,
			OEVBeneficiary: oevBeneficiary.Hex(),
			IsOptimistic:   isOptimistic,
		})

	case "RandomnessRequested":
		// requestId := new(big.Int).SetBytes(vLog.Topics[1].Bytes()) // Not used in new logic
		requester := common.BytesToAddress(vLog.Topics[2].Bytes())

		vals, err := el.oracleABI.Unpack("RandomnessRequested", vLog.Data)
		if err != nil {
			log.Error().Err(err).Msg("Failed to unpack RandomnessRequested")
			return
		}
		
		id := vals[0].(*big.Int).String()
		seed := vals[1].(string)
		
		el.JobManager.Dispatch(oracle.JobRequest{
			ID:        id,
			Type:      oracle.JobTypeVRF,
			Params:    map[string]interface{}{"seed": seed},
			Requester: requester.Hex(),
			Timestamp: time.Now(),
		})
	}
	
	// Mark event as processed
	if el.reorgProtector != nil {
		el.reorgProtector.MarkEventProcessed(vLog.BlockNumber, vLog.TxHash, vLog.Index)
	}
}
