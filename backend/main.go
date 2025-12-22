package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	"github.com/obscura-network/obscura-node/api"
	"github.com/obscura-network/obscura-node/node"
	"github.com/obscura-network/obscura-node/zkp"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Initialize logging
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	log.Info().Msg("Starting Obscura Network Node...")
	
	// Initialize ZK Circuits
	if err := zkp.Init(); err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize ZKP circuits")
	}
	log.Info().Msg("ZKP Circuits initialized and Trusted Setup loaded.")

	// Load Environment Variables
	if err := godotenv.Load("../.env"); err != nil {
		log.Warn().Msg("No .env file found at root, using environment defaults")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Configuration from Env
	rpcURL := getEnv("RPC_URL", "wss://mainnet.infura.io/ws/v3/your-project-id")
	oracleAddr := getEnv("ORACLE_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
	stakingAddr := getEnv("STAKING_ADDRESS", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
	nodePort := getEnv("NODE_PORT", "8080")

	// Initialize Core Node
	obscuraNode, err := node.NewObscuraNode(rpcURL, oracleAddr, stakingAddr, api.State)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize Obscura Node")
	}

	// Start API server
	router := api.NewRouter()
	srv := &http.Server{
		Handler: router,
		Addr:    ":" + nodePort,
	}

	go func() {
		log.Info().Str("port", nodePort).Msg("API Server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("API server failed")
		}
	}()

	// Start Node monitoring loop
	go func() {
		if err := obscuraNode.Run(ctx); err != nil {
			log.Error().Err(err).Msg("Node loop exited with error")
		}
	}()

	log.Info().Msg("Obscura Node is fully operational. Monitoring Mesh...")
	<-ctx.Done()
	
	log.Info().Msg("Shutting down Obscura Node...")
	srv.Shutdown(context.Background())
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
