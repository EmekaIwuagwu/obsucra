package node

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/obscura-network/obscura-node/adapters"
	"github.com/obscura-network/obscura-node/ai"
	"github.com/obscura-network/obscura-node/security"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
)

// Config holds the configuration for the Obscura Node
type Config struct {
	Port          string `mapstructure:"port"`
	LogLevel      string `mapstructure:"log_level"`
	EthereumURL   string `mapstructure:"ethereum_url"`
	PrivateKey    string `mapstructure:"private_key"`
	TelemetryMode bool   `mapstructure:"telemetry_mode"`
}

// Node represents the core Obscura Node structure
type Node struct {
	Config     Config
	Logger     zerolog.Logger
	JobManager *JobManager
	AIModel    *ai.PredictiveModel
	Adapters   *adapters.AdapterManager
	Security   *security.ReputationManager
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

	// Initialize Components
	jobMgr := NewJobManager()
	aiModel := ai.NewPredictiveModel()
	adapterMgr := adapters.NewAdapterManager()
	secMgr := security.NewReputationManager()

	return &Node{
		Config:     cfg,
		Logger:     logger,
		JobManager: jobMgr,
		AIModel:    aiModel,
		Adapters:   adapterMgr,
		Security:   secMgr,
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
		n.AIModel.RunTrainingLoop(ctx)
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
