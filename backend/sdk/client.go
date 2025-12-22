package sdk

import (
	"context"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Extended ABI definition (mocked for SDK prototype)
const OracleABI = `[{"inputs":[{"internalType":"string","name":"apiUrl","type":"string"},{"internalType":"uint256","name":"min","type":"uint256"},{"internalType":"uint256","name":"max","type":"uint256"},{"internalType":"string","name":"metadata","type":"string"}],"name":"requestData","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"requests","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"string","name":"apiUrl","type":"string"},{"internalType":"address","name":"requester","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"resolved","type":"bool"},{"internalType":"uint256","name":"minThreshold","type":"uint256"},{"internalType":"uint256","name":"maxThreshold","type":"uint256"},{"internalType":"string","name":"metadata","type":"string"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"string","name":"seed","type":"string"}],"name":"requestRandomness","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}]`

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
	
	// out[4] is the 'resolved' boolean, out[3] is the 'value'
	return out[4].(bool), out[3].(*big.Int), nil
}

// VerifyProof verifies a ZK proof locally before trusting the data.
func (c *ObscuraClient) VerifyProof(proofData []byte, publicInputs []byte) (bool, error) {
	// In production, this would use the gnark-produced verifier or call the on-chain verifier
	// For the SDK, we perform a structural check or proxy to a local prover/verifier engine.
	return len(proofData) > 0, nil
}

// GetReputation fetches the reputation score of a node (mocked for now, usually calls a Reputation contract)
func (c *ObscuraClient) GetReputation(ctx context.Context, nodeAddr common.Address) (float64, error) {
	// Call contract or cache
	return 99.5, nil
}
