package node

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"

	"github.com/obscura-network/obscura-node/adapters"
	"github.com/obscura-network/obscura-node/ai"
	"github.com/obscura-network/obscura-node/automation"
	"github.com/obscura-network/obscura-node/crosschain"
	"github.com/obscura-network/obscura-node/security"
	"github.com/obscura-network/obscura-node/staking"
	"github.com/obscura-network/obscura-node/storage"
	"github.com/obscura-network/obscura-node/vrf"
)

// Config holds the configuration for the Obscura Node
type Config struct {
	Port          string `mapstructure:"port"`
	LogLevel      string `mapstructure:"log_level"`
	EthereumURL   string `mapstructure:"ethereum_url"`
	PrivateKey    string `mapstructure:"private_key"`
	TelemetryMode bool   `mapstructure:"telemetry_mode"`
	DBPath        string `mapstructure:"db_path"`
}

// Node represents the core Obscura Node structure
type Node struct {
	Config     Config
	Logger     zerolog.Logger
	JobManager *JobManager
	Adapters   *adapters.AdapterManager
	Security   *security.ReputationManager
	Storage    storage.Store
	VRF        *vrf.RandomnessManager
	AI         *ai.PredictiveModel
	Automation *automation.TriggerManager
	Bridge     *crosschain.CrossLink
	StakeGuard *staking.StakeGuard
	StakeSync  *StakeSync
	Listener   *EventListener
}

// NewNode initializes a new Obscura Node
func NewNode() (*Node, error) {
	// Setup Logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	logger := log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	// Setup Configuration via Viper
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AutomaticEnv()

	// Defaults
	viper.SetDefault("port", "8080")
	viper.SetDefault("log_level", "info")
	viper.SetDefault("telemetry_mode", true)
	viper.SetDefault("db_path", "./node.db.json")
	viper.SetDefault("ethereum_url", "http://localhost:8545")
	viper.SetDefault("oracle_contract_address", "0x0000000000000000000000000000000000000000")
	viper.SetDefault("stake_guard_address", "0x0000000000000000000000000000000000000000")
	viper.SetDefault("private_key", "0000000000000000000000000000000000000000000000000000000000000000")

	if err := viper.ReadInConfig(); err != nil {
		logger.Warn().Err(err).Msg("Config file not found, using defaults/environment variables")
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err == nil {
		zerolog.SetGlobalLevel(level)
	}

	// Initialize Storage
	store, err := storage.NewFileStore(viper.GetString("db_path"))
	if err != nil {
		return nil, fmt.Errorf("failed to init storage: %w", err)
	}

	// Connect to Eth Client early for JobManager
	client, err := ethclient.Dial(cfg.EthereumURL)
	if err != nil {
		return nil, fmt.Errorf("failed to dial ethereum: %w", err)
	}

	// Initialize Components
	adapterMgr := adapters.NewAdapterManager()
	vrfMgr := vrf.NewRandomnessManager(viper.GetString("private_key"))
	secMgr := security.NewReputationManager()
	stakingMgr := staking.NewStakeGuard()
	
	// Initialize TxManager
	txMgr, err := NewTxManager(client, viper.GetString("private_key"))
	if err != nil {
		return nil, fmt.Errorf("failed to init tx manager: %w", err)
	}

	jobMgr, err := NewJobManager(
		adapterMgr, 
		txMgr, 
		vrfMgr,
		secMgr,
		viper.GetString("oracle_contract_address"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to init job manager: %w", err)
	}

	aiModel := ai.NewPredictiveModel()
	automationMgr := automation.NewTriggerManager()
	crosslink := crosschain.NewCrossLink()
	stakeSync, _ := NewStakeSync(client, viper.GetString("stake_guard_address"), secMgr)
	
	listener, err := NewEventListener(jobMgr, cfg.EthereumURL, viper.GetString("oracle_contract_address"))
	if err != nil {
		return nil, fmt.Errorf("failed to init event listener: %w", err)
	}

	return &Node{
		Config:     cfg,
		Logger:     logger,
		JobManager: jobMgr,
		Adapters:   adapterMgr,
		Security:   secMgr,
		Storage:    store,
		VRF:        vrfMgr,
		AI:         aiModel,
		Automation: automationMgr,
		Bridge:     crosslink,
		StakeGuard: stakingMgr,
		StakeSync:  stakeSync,
		Listener:   listener,
	}, nil
}

// Run starts the node's main loop and services
func (n *Node) Run() error {
	n.Logger.Info().Msgf("Starting Obscura Node on port %s", n.Config.Port)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup

	// Start Jobs Processor
	wg.Add(1)
	go func() {
		defer wg.Done()
		n.JobManager.Start(ctx)
	}()

	// Start AI Forecasting Service
	wg.Add(1)
	go func() {
		defer wg.Done()
		n.AI.RunTrainingLoop(ctx)
	}()

	// Start Event Listener
	wg.Add(1)
	go func() {
		defer wg.Done()
		n.Listener.Start(ctx)
	}()
	
	// Start Automation Trigger Service
	wg.Add(1)
	go func() {
		defer wg.Done()
		n.Automation.CheckConditions(ctx)
	}()

	// Start Stake Guard Sync
	wg.Add(1)
	go func() {
		defer wg.Done()
		n.StakeSync.Start(ctx)
	}()

	// Start API Server (Placeholder)
	wg.Add(1)
	go func() {
		defer wg.Done()
		n.serveAPI(ctx)
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	n.Logger.Info().Msg("Shutting down Obscura Node...")
	cancel()
	wg.Wait()
	n.Logger.Info().Msg("Node Shutdown Complete")

	return nil
}

func (n *Node) serveAPI(ctx context.Context) {
	// In a real implementation, this would be an HTTP/gRPC server
	<-ctx.Done()
}
