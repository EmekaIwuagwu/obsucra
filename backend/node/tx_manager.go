package node

import (
	"context"
	"crypto/ecdsa"
	"math/big"
	"sync"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
)

// TxManager handles concurrent transaction submission, nonce tracking, and gas estimation.
type TxManager struct {
	client     *ethclient.Client
	privateKey *ecdsa.PrivateKey
	fromAddr   common.Address
	chainID    *big.Int
	
	mu    sync.Mutex
	nonce uint64
}

func NewTxManager(client *ethclient.Client, pkHex string) (*TxManager, error) {
	pk, err := crypto.HexToECDSA(pkHex)
	if err != nil {
		return nil, err
	}
	
	fromAddr := crypto.PubkeyToAddress(pk.PublicKey)
	chainID, err := client.ChainID(context.Background())
	if err != nil {
		return nil, err
	}

	nonce, err := client.PendingNonceAt(context.Background(), fromAddr)
	if err != nil {
		return nil, err
	}

	return &TxManager{
		client:     client,
		privateKey: pk,
		fromAddr:   fromAddr,
		chainID:    chainID,
		nonce:      nonce,
	}, nil
}

func (tm *TxManager) SendTransaction(ctx context.Context, to common.Address, data []byte, value *big.Int) (common.Hash, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	gasPrice, err := tm.client.SuggestGasPrice(ctx)
	if err != nil {
		return common.Hash{}, err
	}

	msg := ethereum.CallMsg{
		From: tm.fromAddr,
		To:   &to,
		Data: data,
		Value: value,
	}
	gasLimit, err := tm.client.EstimateGas(ctx, msg)
	if err != nil {
		log.Warn().Err(err).Msg("Gas estimation failed, using fallback")
		gasLimit = 500000
	}

	tx := types.NewTransaction(tm.nonce, to, value, gasLimit, gasPrice, data)
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(tm.chainID), tm.privateKey)
	if err != nil {
		return common.Hash{}, err
	}

	err = tm.client.SendTransaction(ctx, signedTx)
	if err != nil {
		// If nonce is too low, refresh it
		if err.Error() == "nonce too low" {
			n, _ := tm.client.PendingNonceAt(ctx, tm.fromAddr)
			tm.nonce = n
			return tm.SendTransaction(ctx, to, data, value)
		}
		return common.Hash{}, err
	}

	tm.nonce++
	return signedTx.Hash(), nil
}
