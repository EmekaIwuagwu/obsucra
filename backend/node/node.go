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
	"github.com/obscura-network/obscura-node/api"
	"github.com/obscura-network/obscura-node/automation"
	"github.com/obscura-network/obscura-node/crosschain"
	"github.com/obscura-network/obscura-node/functions"
	"github.com/obscura-network/obscura-node/security"
	"github.com/obscura-network/obscura-node/staking"
	"github.com/obscura-network/obscura-node/storage"
	"github.com/obscura-network/obscura-node/vrf"
	"github.com/obscura-network/obscura-node/oracle"
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
	Listener    *EventListener
	Metrics     *api.MetricsCollector
	FeedManager *oracle.FeedManager
	Secrets     *storage.SecretManager
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
	computeMgr, _ := functions.NewComputeManager(context.Background())
	feedManager := oracle.NewFeedManager()
	aiModel := ai.NewPredictiveModel()
	secretManager := storage.NewSecretManager()
	
	// Register some default feeds for the demo
	feedManager.RegisterFeed(&oracle.FeedConfig{ID: "ETH-USD", Name: "Ethereum", Active: true})
	feedManager.RegisterFeed(&oracle.FeedConfig{ID: "BTC-USD", Name: "Bitcoin", Active: true})
	
	// Initialize TxManager
	txMgr, err := NewTxManager(client, viper.GetString("private_key"))
	if err != nil {
		return nil, fmt.Errorf("failed to init tx manager: %w", err)
	}

	// Reorg Protection & Persistence
	jp := NewJobPersistence(store)
	reorgProtector, err := NewReorgProtector(client, store, 12) // 12 confirmations
	if err != nil {
		return nil, fmt.Errorf("failed to init reorg protector: %w", err)
	}

	metricsCollector := api.NewMetricsCollector()

	jobMgr, err := NewJobManager(
		adapterMgr,
		txMgr,
		vrfMgr,
		secMgr,
		computeMgr,
		viper.GetString("oracle_contract_address"),
		jp,
		metricsCollector,
		feedManager,
		aiModel,
		secretManager,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to init job manager: %w", err)
	}

	automationMgr := automation.NewTriggerManager(jobMgr.JobQueue)
	crosslink := crosschain.NewCrossLink()
	stakeSync, _ := NewStakeSync(client, viper.GetString("stake_guard_address"), secMgr)

	listener, err := NewEventListener(jobMgr, cfg.EthereumURL, viper.GetString("oracle_contract_address"), reorgProtector)
	if err != nil {
		return nil, fmt.Errorf("failed to init event listener: %w", err)
	}

	// Start Background Activity Simulator for Demo (Feature #1, #2, #4)
	go func() {
		ticker := time.NewTicker(7 * time.Second)
		for range ticker.C {
			metricsCollector.IncrementRequestsProcessed()
			if time.Now().Unix()%2 == 0 {
				metricsCollector.IncrementProofsGenerated()
				metricsCollector.IncrementOEVRecaptured(1500 + uint64(time.Now().Unix()%1000))
			}
			
			// 4. Update Feed Values for Dashboard (Feature #4)
			priceBase := 3800.0
			if time.Now().Unix()%2 == 0 {
				priceBase = 3850.0
			}
			
			feedManager.UpdateFeedValue(oracle.FeedLiveStatus{
				ID:                 "ETH-USD",
				Value:              fmt.Sprintf("$%.2f", priceBase + (float64(time.Now().Unix()%100) * 0.1)),
				Confidence:         99.0 + (float64(time.Now().Unix()%10) * 0.1),
				Outliers:           0,
				RoundID:            uint64(time.Now().Unix() / 60),
				Timestamp:          time.Now(),
				IsZK:               true,
				IsOptimistic:       false,
				ConfidenceInterval: "± 0.04%",
			})

			// Add a mock job record to history
			metricsCollector.AddJobRecord(api.JobRecord{
				ID:        fmt.Sprintf("auto-%d", time.Now().Unix()),
				Type:      "Data Feed",
				Target:    "ETH/USD",
				Status:    "Fulfilled",
				Hash:      fmt.Sprintf("0x%x...%d", time.Now().Unix(), time.Now().Unix()%10),
				RoundID:   uint64(time.Now().Unix() / 60),
				Timestamp: time.Now(),
			})
		}
	}()

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
		Metrics:    metricsCollector,
		FeedManager: feedManager,
		Secrets:    secretManager,
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

	// Start Metrics & Monitoring API Server
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
	// Start metrics server on configured port
	metricsServer := api.NewMetricsServer(n.Metrics, n.FeedManager, n.Config.Port)
	
	// Run server in goroutine
	go func() {
		if err := metricsServer.Start(); err != nil {
			n.Logger.Error().Err(err).Msg("Metrics server failed")
		}
	}()
	
	n.Logger.Info().Str("port", n.Config.Port).Msg("Metrics API server started")
	
	// Wait for shutdown signal
	<-ctx.Done()
	n.Logger.Info().Msg("Metrics API server shutting down")
}
