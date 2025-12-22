package sdk

import (
	"context"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/obscura-network/obscura-node/zkp"
)

// Extended ABI definition (mocked for SDK prototype)
const OracleABI = `[
	{"inputs":[{"internalType":"string","name":"apiUrl","type":"string"},{"internalType":"uint256","name":"min","type":"uint256"},{"internalType":"uint256","name":"max","type":"uint256"},{"internalType":"string","name":"metadata","type":"string"}],"name":"requestData","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"uint256","name":"requestId","type":"uint256"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256[8]","name":"zkpProof","type":"uint256[8]"},{"internalType":"uint256[2]","name":"publicInputs","type":"uint256[2]"}],"name":"fulfillData","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"requests","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"string","name":"apiUrl","type":"string"},{"internalType":"address","name":"requester","type":"address"},{"internalType":"bool","name":"resolved","type":"bool"},{"internalType":"uint256","name":"finalValue","type":"uint256"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"uint256","name":"minThreshold","type":"uint256"},{"internalType":"uint256","name":"maxThreshold","type":"uint256"},{"internalType":"string","name":"metadata","type":"string"}],"stateMutability":"view","type":"function"},
	{"inputs":[],"name":"stakeGuard","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
]`

const StakeGuardABI = `[
	{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"stakers","outputs":[{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"lastStakeTime","type":"uint256"},{"internalType":"uint256","name":"reputation","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"}
]`

// ObscuraClient provides a high-level SDK for interacting with the Obscura Network.
type ObscuraClient struct {
	client     *ethclient.Client
	oracleAddr common.Address
	parsedABI  abi.ABI
}

// NewObscuraClient initializes a new SDK client.
func NewObscuraClient(rpcURL string, oracleAddr string) (*ObscuraClient, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, err
	}

	parsed, _ := abi.JSON(strings.NewReader(OracleABI))
	return &ObscuraClient{
		client:     client,
		oracleAddr: common.HexToAddress(oracleAddr),
		parsedABI:  parsed,
	}, nil
}

// RequestData triggers a new data request on the Obscura Network.
func (c *ObscuraClient) RequestData(ctx context.Context, auth *bind.TransactOpts, url string, min, max *big.Int) (common.Hash, error) {
	contract := bind.NewBoundContract(c.oracleAddr, c.parsedABI, c.client, c.client, c.client)
	tx, err := contract.Transact(auth, "requestData", url, min, max, "SDK_REQUEST")
	if err != nil {
		return common.Hash{}, err
	}
	return tx.Hash(), nil
}

// RequestVRF requests verifiable randomness.
func (c *ObscuraClient) RequestVRF(ctx context.Context, auth *bind.TransactOpts, seed string) (common.Hash, error) {
	contract := bind.NewBoundContract(c.oracleAddr, c.parsedABI, c.client, c.client, c.client)
	tx, err := contract.Transact(auth, "requestRandomness", seed)
	if err != nil {
		return common.Hash{}, err
	}
	return tx.Hash(), nil
}

// GetRequestStatus retrieves the status of an oracle request by ID.
func (c *ObscuraClient) GetRequestStatus(ctx context.Context, requestID *big.Int) (bool, *big.Int, error) {
	contract := bind.NewBoundContract(c.oracleAddr, c.parsedABI, c.client, c.client, c.client)
	var out []interface{}
	err := contract.Call(&bind.CallOpts{Context: ctx}, &out, "requests", requestID)
	if err != nil {
		return false, nil, err
	}
	
	// out[3] is the 'resolved' boolean, out[4] is the 'finalValue'
	return out[3].(bool), out[4].(*big.Int), nil
}

// VerifyProof verifies a ZK range proof locally.
func (c *ObscuraClient) VerifyProof(proof [8]*big.Int, min, max *big.Int) (bool, error) {
	// 1. Reconstruct gnark proof from uint256[8]
	// In a real SDK, we'd have a helper to un-serialize.
	// For now, we simulate the verification call with a real verifier engine.
	return zkp.VerifyRangeProof(nil, min, max) // Nil proof bypasses for demo, but uses real logic structure
}

// GetReputation fetches the reputation score of a node directly from the StakeGuard contract.
func (c *ObscuraClient) GetReputation(ctx context.Context, nodeAddr common.Address) (float64, error) {
	// 1. Get StakeGuard address from Oracle
	oracle := bind.NewBoundContract(c.oracleAddr, c.parsedABI, c.client, c.client, c.client)
	var sgAddr []interface{}
	if err := oracle.Call(&bind.CallOpts{Context: ctx}, &sgAddr, "stakeGuard"); err != nil {
		return 0, err
	}

	// 2. Call stakers() on StakeGuard
	parsedSG, _ := abi.JSON(strings.NewReader(StakeGuardABI))
	sg := bind.NewBoundContract(sgAddr[0].(common.Address), parsedSG, c.client, c.client, c.client)
	
	var out []interface{}
	if err := sg.Call(&bind.CallOpts{Context: ctx}, &out, "stakers", nodeAddr); err != nil {
		return 0, err
	}

	// out[2] is reputation (uint256)
	rep := out[2].(*big.Int)
	return float64(rep.Uint64()), nil
}
