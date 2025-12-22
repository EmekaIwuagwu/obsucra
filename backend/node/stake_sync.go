package node

import (
	"context"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog/log"
	"github.com/obscura-network/obscura-node/security"
)

const StakeGuardABI = `[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Unstaked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"node","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"string","name":"reason","type":"string"}],"name":"Slashed","type":"event"}]`

type StakeSync struct {
	client       *ethclient.Client
	contractAddr common.Address
	abi          abi.ABI
	reputation   *security.ReputationManager
}

func NewStakeSync(client *ethclient.Client, addr string, rep *security.ReputationManager) (*StakeSync, error) {
	parsed, err := abi.JSON(strings.NewReader(StakeGuardABI))
	if err != nil {
		return nil, err
	}
	return &StakeSync{
		client:       client,
		contractAddr: common.HexToAddress(addr),
		abi:          parsed,
		reputation:   rep,
	}, nil
}

func (ss *StakeSync) Start(ctx context.Context) {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{ss.contractAddr},
	}

	logs := make(chan types.Log)
	sub, err := ss.client.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to subscribe to StakeGuard events")
		return
	}
	defer sub.Unsubscribe()

	for {
		select {
		case <-ctx.Done():
			return
		case vLog := <-logs:
			ss.handleLog(vLog)
		}
	}
}

func (ss *StakeSync) handleLog(vLog types.Log) {
	event, err := ss.abi.EventByID(vLog.Topics[0])
	if err != nil {
		return
	}

	switch event.Name {
	case "Staked":
		var ev struct {
			User   common.Address
			Amount *big.Int
		}
		err := ss.abi.UnpackIntoInterface(&ev, "Staked", vLog.Data)
		if err == nil {
			log.Info().Str("node", ev.User.Hex()).Str("amount", ev.Amount.String()).Msg("Node Staked detected on-chain")
		}
	case "Slashed":
		var ev struct {
			Node   common.Address
			Amount *big.Int
			Reason string
		}
		err := ss.abi.UnpackIntoInterface(&ev, "Slashed", vLog.Data)
		if err == nil {
			log.Warn().Str("node", ev.Node.Hex()).Str("reason", ev.Reason).Msg("Node Slashed detected on-chain")
			// Local reputation penalty
			ss.reputation.UpdateReputation(ev.Node.Hex(), -10.0)
		}
	}
}
