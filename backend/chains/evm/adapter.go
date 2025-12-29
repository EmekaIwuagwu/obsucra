package evm

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"

	"github.com/obscura-network/obscura-node/chains"
)

// EVMAdapter implements ChainAdapter for EVM-compatible chains
type EVMAdapter struct {
	mu           sync.RWMutex
	config       *chains.ChainConfig
	client       *ethclient.Client
	wsClient     *ethclient.Client
	privateKey   *ecdsa.PrivateKey
	fromAddress  common.Address
	oracleABI    abi.ABI
	connected    bool
	gasPricer    *GasPricer
}

// OracleABI is the ABI for ObscuraOracle contract
const OracleABI = `[
	{
		"name": "fulfillData",
		"type": "function",
		"inputs": [
			{"name": "requestId", "type": "uint256"},
			{"name": "value", "type": "uint256"},
			{"name": "zkpProof", "type": "uint256[8]"},
			{"name": "publicInputs", "type": "uint256[2]"}
		]
	},
	{
		"name": "fulfillDataWithOEV",
		"type": "function",
		"inputs": [
			{"name": "requestId", "type": "uint256"},
			{"name": "value", "type": "uint256"},
			{"name": "zkpProof", "type": "uint256[8]"},
			{"name": "publicInputs", "type": "uint256[2]"},
			{"name": "oevBid", "type": "uint256"}
		]
	},
	{
		"name": "fulfillRandomness",
		"type": "function",
		"inputs": [
			{"name": "requestId", "type": "uint256"},
			{"name": "randomness", "type": "uint256"},
			{"name": "proof", "type": "bytes"}
		]
	},
	{
		"name": "latestRoundData",
		"type": "function",
		"outputs": [
			{"name": "roundId", "type": "uint80"},
			{"name": "answer", "type": "int256"},
			{"name": "startedAt", "type": "uint256"},
			{"name": "updatedAt", "type": "uint256"},
			{"name": "answeredInRound", "type": "uint80"}
		]
	},
	{
		"name": "getRoundData",
		"type": "function",
		"inputs": [{"name": "_roundId", "type": "uint80"}],
		"outputs": [
			{"name": "roundId", "type": "uint80"},
			{"name": "answer", "type": "int256"},
			{"name": "startedAt", "type": "uint256"},
			{"name": "updatedAt", "type": "uint256"},
			{"name": "answeredInRound", "type": "uint80"}
		]
	},
	{
		"name": "RequestData",
		"type": "event",
		"inputs": [
			{"name": "requestId", "type": "uint256", "indexed": true},
			{"name": "apiUrl", "type": "string"},
			{"name": "min", "type": "uint256"},
			{"name": "max", "type": "uint256"},
			{"name": "requester", "type": "address", "indexed": true},
			{"name": "oevEnabled", "type": "bool"},
			{"name": "oevBeneficiary", "type": "address"},
			{"name": "isOptimistic", "type": "bool"}
		]
	},
	{
		"name": "RandomnessRequested",
		"type": "event",
		"inputs": [
			{"name": "requestId", "type": "uint256", "indexed": true},
			{"name": "seed", "type": "string"},
			{"name": "requester", "type": "address", "indexed": true}
		]
	}
]`

// NewEVMAdapter creates a new EVM chain adapter
func NewEVMAdapter(config *chains.ChainConfig, privateKeyHex string) (*EVMAdapter, error) {
	var pk *ecdsa.PrivateKey
	var err error

	if privateKeyHex != "" && !strings.HasPrefix(privateKeyHex, "000000000000") {
		pk, err = crypto.HexToECDSA(privateKeyHex)
		if err != nil {
			return nil, fmt.Errorf("invalid private key: %w", err)
		}
	} else {
		pk, _ = crypto.GenerateKey()
		log.Warn().Str("chain", config.Name).Msg("Using ephemeral key for EVM adapter")
	}

	fromAddress := crypto.PubkeyToAddress(pk.PublicKey)

	parsedABI, err := abi.JSON(strings.NewReader(OracleABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse oracle ABI: %w", err)
	}

	return &EVMAdapter{
		config:      config,
		privateKey:  pk,
		fromAddress: fromAddress,
		oracleABI:   parsedABI,
		gasPricer:   NewGasPricer(config.GasStrategy),
	}, nil
}

// Name returns the chain name
func (a *EVMAdapter) Name() string {
	return a.config.Name
}

// ChainID returns the chain ID
func (a *EVMAdapter) ChainID() uint64 {
	return a.config.ChainID
}

// ChainType returns the chain type
func (a *EVMAdapter) ChainType() chains.ChainType {
	return chains.ChainTypeEVM
}

// Connect establishes connection to the chain
func (a *EVMAdapter) Connect(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	client, err := ethclient.DialContext(ctx, a.config.RPCURL)
	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", a.config.Name, err)
	}

	// Verify chain ID
	chainID, err := client.ChainID(ctx)
	if err != nil {
		client.Close()
		return fmt.Errorf("failed to get chain ID: %w", err)
	}

	if chainID.Uint64() != a.config.ChainID {
		client.Close()
		return fmt.Errorf("chain ID mismatch: expected %d, got %d", a.config.ChainID, chainID.Uint64())
	}

	a.client = client

	// Connect WebSocket for event subscription if available
	if a.config.WebSocketURL != "" {
		wsClient, err := ethclient.DialContext(ctx, a.config.WebSocketURL)
		if err != nil {
			log.Warn().Err(err).Str("chain", a.config.Name).Msg("WebSocket connection failed, events may be delayed")
		} else {
			a.wsClient = wsClient
		}
	}

	a.connected = true
	log.Info().
		Str("chain", a.config.Name).
		Uint64("chainId", a.config.ChainID).
		Str("address", a.fromAddress.Hex()).
		Msg("EVM adapter connected")

	return nil
}

// Disconnect closes the connection
func (a *EVMAdapter) Disconnect() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.client != nil {
		a.client.Close()
	}
	if a.wsClient != nil {
		a.wsClient.Close()
	}
	a.connected = false
	return nil
}

// IsConnected returns connection status
func (a *EVMAdapter) IsConnected() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.connected
}

// HealthCheck verifies the connection is healthy
func (a *EVMAdapter) HealthCheck(ctx context.Context) error {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected || a.client == nil {
		return fmt.Errorf("not connected")
	}

	_, err := a.client.BlockNumber(ctx)
	return err
}

// SubmitOracleUpdate submits an oracle update to the chain
func (a *EVMAdapter) SubmitOracleUpdate(ctx context.Context, params chains.OracleUpdateParams) (*chains.TransactionReceipt, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return nil, fmt.Errorf("not connected to %s", a.config.Name)
	}

	// Get nonce
	nonce, err := a.client.PendingNonceAt(ctx, a.fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get gas price
	gasPrice, err := a.gasPricer.GetGasPrice(ctx, a.client)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// Prepare ZK proof array
	var zkProof [8]*big.Int
	for i := 0; i < 8; i++ {
		if i < len(params.ZKProof)/32 {
			zkProof[i] = new(big.Int).SetBytes(params.ZKProof[i*32 : (i+1)*32])
		} else {
			zkProof[i] = big.NewInt(0)
		}
	}

	// Pack call data
	var data []byte
	if params.OEVBid != nil && params.OEVBid.Sign() > 0 {
		data, err = a.oracleABI.Pack("fulfillDataWithOEV",
			big.NewInt(int64(params.RequestID)),
			params.Value,
			zkProof,
			params.PublicInputs,
			params.OEVBid,
		)
	} else {
		data, err = a.oracleABI.Pack("fulfillData",
			big.NewInt(int64(params.RequestID)),
			params.Value,
			zkProof,
			params.PublicInputs,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to pack call data: %w", err)
	}

	// Create transaction based on gas strategy
	var tx *types.Transaction
	oracleAddr := common.HexToAddress(a.config.OracleContract)

	switch a.config.GasStrategy {
	case chains.GasStrategyEIP1559:
		tip := big.NewInt(1e9) // 1 gwei priority fee
		tx = types.NewTx(&types.DynamicFeeTx{
			ChainID:   big.NewInt(int64(a.config.ChainID)),
			Nonce:     nonce,
			GasTipCap: tip,
			GasFeeCap: new(big.Int).Add(gasPrice, tip),
			Gas:       500000,
			To:        &oracleAddr,
			Data:      data,
		})
	default:
		tx = types.NewTx(&types.LegacyTx{
			Nonce:    nonce,
			GasPrice: gasPrice,
			Gas:      500000,
			To:       &oracleAddr,
			Data:     data,
		})
	}

	// Sign and send transaction
	signedTx, err := types.SignTx(tx, types.LatestSignerForChainID(big.NewInt(int64(a.config.ChainID))), a.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	err = a.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	log.Info().
		Str("chain", a.config.Name).
		Str("txHash", signedTx.Hash().Hex()).
		Uint64("requestId", params.RequestID).
		Msg("Oracle update submitted")

	// Wait for confirmation
	receipt, err := bind.WaitMined(ctx, a.client, signedTx)
	if err != nil {
		return nil, fmt.Errorf("failed to wait for confirmation: %w", err)
	}

	return &chains.TransactionReceipt{
		TxHash:      receipt.TxHash.Hex(),
		BlockNumber: receipt.BlockNumber.Uint64(),
		GasUsed:     receipt.GasUsed,
		Status:      receipt.Status == 1,
	}, nil
}

// GetLatestRoundData retrieves the latest oracle round data
func (a *EVMAdapter) GetLatestRoundData(ctx context.Context, feedID string) (*chains.RoundData, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return nil, fmt.Errorf("not connected")
	}

	data, err := a.oracleABI.Pack("latestRoundData")
	if err != nil {
		return nil, err
	}

	oracleAddr := common.HexToAddress(a.config.OracleContract)
	result, err := a.client.CallContract(ctx, ethereum.CallMsg{
		To:   &oracleAddr,
		Data: data,
	}, nil)
	if err != nil {
		return nil, err
	}

	outputs, err := a.oracleABI.Unpack("latestRoundData", result)
	if err != nil {
		return nil, err
	}

	roundID := outputs[0].(*big.Int)
	answer := outputs[1].(*big.Int)
	startedAt := outputs[2].(*big.Int)
	updatedAt := outputs[3].(*big.Int)
	answeredInRound := outputs[4].(*big.Int)

	return &chains.RoundData{
		RoundID:         roundID.Uint64(),
		Answer:          answer,
		StartedAt:       time.Unix(startedAt.Int64(), 0),
		UpdatedAt:       time.Unix(updatedAt.Int64(), 0),
		AnsweredInRound: answeredInRound.Uint64(),
		Decimals:        8,
		Description:     feedID,
	}, nil
}

// GetRoundData retrieves specific round data
func (a *EVMAdapter) GetRoundData(ctx context.Context, feedID string, roundID uint64) (*chains.RoundData, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return nil, fmt.Errorf("not connected")
	}

	data, err := a.oracleABI.Pack("getRoundData", big.NewInt(int64(roundID)))
	if err != nil {
		return nil, err
	}

	oracleAddr := common.HexToAddress(a.config.OracleContract)
	result, err := a.client.CallContract(ctx, ethereum.CallMsg{
		To:   &oracleAddr,
		Data: data,
	}, nil)
	if err != nil {
		return nil, err
	}

	outputs, err := a.oracleABI.Unpack("getRoundData", result)
	if err != nil {
		return nil, err
	}

	return &chains.RoundData{
		RoundID:         outputs[0].(*big.Int).Uint64(),
		Answer:          outputs[1].(*big.Int),
		StartedAt:       time.Unix(outputs[2].(*big.Int).Int64(), 0),
		UpdatedAt:       time.Unix(outputs[3].(*big.Int).Int64(), 0),
		AnsweredInRound: outputs[4].(*big.Int).Uint64(),
		Decimals:        8,
		Description:     feedID,
	}, nil
}

// SubmitVRFResult submits a VRF result to the chain
func (a *EVMAdapter) SubmitVRFResult(ctx context.Context, requestID string, randomness *big.Int, proof []byte) (*chains.TransactionReceipt, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return nil, fmt.Errorf("not connected")
	}

	nonce, err := a.client.PendingNonceAt(ctx, a.fromAddress)
	if err != nil {
		return nil, err
	}

	gasPrice, _ := a.gasPricer.GetGasPrice(ctx, a.client)

	reqID := new(big.Int)
	reqID.SetString(requestID, 10)

	data, err := a.oracleABI.Pack("fulfillRandomness", reqID, randomness, proof)
	if err != nil {
		return nil, err
	}

	oracleAddr := common.HexToAddress(a.config.OracleContract)
	tx := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		GasPrice: gasPrice,
		Gas:      300000,
		To:       &oracleAddr,
		Data:     data,
	})

	signedTx, err := types.SignTx(tx, types.LatestSignerForChainID(big.NewInt(int64(a.config.ChainID))), a.privateKey)
	if err != nil {
		return nil, err
	}

	err = a.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return nil, err
	}

	receipt, err := bind.WaitMined(ctx, a.client, signedTx)
	if err != nil {
		return nil, err
	}

	return &chains.TransactionReceipt{
		TxHash:      receipt.TxHash.Hex(),
		BlockNumber: receipt.BlockNumber.Uint64(),
		GasUsed:     receipt.GasUsed,
		Status:      receipt.Status == 1,
	}, nil
}

// EstimateGas estimates gas for an oracle update
func (a *EVMAdapter) EstimateGas(ctx context.Context, feed string, value *big.Int) (uint64, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return 0, fmt.Errorf("not connected")
	}

	// Return estimated gas based on typical oracle update
	return 150000, nil
}

// GetGasPrice returns current gas price info
func (a *EVMAdapter) GetGasPrice(ctx context.Context) (*chains.GasPriceInfo, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return nil, fmt.Errorf("not connected")
	}

	gasPrice, err := a.gasPricer.GetGasPrice(ctx, a.client)
	if err != nil {
		return nil, err
	}

	info := &chains.GasPriceInfo{
		GasPrice: gasPrice,
	}

	// Get EIP-1559 info if available
	if a.config.GasStrategy == chains.GasStrategyEIP1559 {
		header, err := a.client.HeaderByNumber(ctx, nil)
		if err == nil && header.BaseFee != nil {
			info.BaseFee = header.BaseFee
			info.MaxFeePerGas = new(big.Int).Add(header.BaseFee, big.NewInt(2e9))
			info.MaxPriorityFee = big.NewInt(1e9)
		}
	}

	return info, nil
}

// SubscribeOracleRequests subscribes to oracle request events
func (a *EVMAdapter) SubscribeOracleRequests(ctx context.Context, callback chains.OracleRequestCallback) error {
	a.mu.RLock()
	client := a.wsClient
	if client == nil {
		client = a.client
	}
	a.mu.RUnlock()

	if client == nil {
		return fmt.Errorf("not connected")
	}

	oracleAddr := common.HexToAddress(a.config.OracleContract)
	query := ethereum.FilterQuery{
		Addresses: []common.Address{oracleAddr},
	}

	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("failed to subscribe: %w", err)
	}

	go func() {
		defer sub.Unsubscribe()
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-sub.Err():
				log.Error().Err(err).Str("chain", a.config.Name).Msg("Subscription error")
				return
			case vLog := <-logs:
				a.processOracleEvent(vLog, callback)
			}
		}
	}()

	log.Info().Str("chain", a.config.Name).Msg("Subscribed to oracle request events")
	return nil
}

func (a *EVMAdapter) processOracleEvent(vLog types.Log, callback chains.OracleRequestCallback) {
	// Parse RequestData event
	eventSig := vLog.Topics[0].Hex()
	requestDataSig := crypto.Keccak256Hash([]byte("RequestData(uint256,string,uint256,uint256,address,bool,address,bool)")).Hex()

	if eventSig == requestDataSig {
		requestID := new(big.Int).SetBytes(vLog.Topics[1].Bytes())

		request := &chains.OracleRequest{
			RequestID:   requestID.Uint64(),
			ChainID:     a.config.ChainID,
			BlockNumber: vLog.BlockNumber,
			TxHash:      vLog.TxHash.Hex(),
			Timestamp:   time.Now(),
		}

		callback(request)
	}
}

// SubscribeVRFRequests subscribes to VRF request events
func (a *EVMAdapter) SubscribeVRFRequests(ctx context.Context, callback chains.VRFRequestCallback) error {
	// Similar implementation to SubscribeOracleRequests
	return nil
}

// DeployContracts deploys a contract to the chain
func (a *EVMAdapter) DeployContracts(ctx context.Context, bytecode []byte, constructorArgs []interface{}) (string, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if !a.connected {
		return "", fmt.Errorf("not connected to %s", a.config.Name)
	}

	// Get nonce
	nonce, err := a.client.PendingNonceAt(ctx, a.fromAddress)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get gas price
	gasPrice, err := a.gasPricer.GetGasPrice(ctx, a.client)
	if err != nil {
		return "", fmt.Errorf("failed to get gas price: %w", err)
	}

	// Create deployment transaction
	tx := types.NewContractCreation(
		nonce,
		big.NewInt(0), // No ETH value
		3000000,       // Gas limit for deployment
		gasPrice,
		bytecode,
	)

	// Sign transaction
	signedTx, err := types.SignTx(tx, types.LatestSignerForChainID(big.NewInt(int64(a.config.ChainID))), a.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = a.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	log.Info().
		Str("chain", a.config.Name).
		Str("txHash", signedTx.Hash().Hex()).
		Msg("Contract deployment transaction sent")

	// Wait for receipt
	receipt, err := bind.WaitMined(ctx, a.client, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to wait for confirmation: %w", err)
	}

	if receipt.Status != 1 {
		return "", fmt.Errorf("contract deployment failed: tx reverted")
	}

	contractAddress := receipt.ContractAddress.Hex()
	log.Info().
		Str("chain", a.config.Name).
		Str("address", contractAddress).
		Msg("Contract deployed successfully")

	return contractAddress, nil
}

// GasPricer handles gas pricing strategies
type GasPricer struct {
	strategy chains.GasStrategy
}

// NewGasPricer creates a new gas pricer
func NewGasPricer(strategy chains.GasStrategy) *GasPricer {
	return &GasPricer{strategy: strategy}
}

// GetGasPrice returns the appropriate gas price
func (g *GasPricer) GetGasPrice(ctx context.Context, client *ethclient.Client) (*big.Int, error) {
	return client.SuggestGasPrice(ctx)
}
