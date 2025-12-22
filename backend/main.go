package main

import (
	"os"

	"github.com/joho/godotenv"
	"github.com/obscura-network/obscura-node/node"
	"github.com/obscura-network/obscura-node/zkp"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Initialize logging
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	log.Info().Msg("Starting Obscura Network Node (v2.0 Architecture)...")

	// Load Environment Variables
	if err := godotenv.Load("../.env"); err != nil {
		log.Warn().Msg("No .env file found, using defaults/environment variables")
	}

	// Initialize ZK Circuits (Legacy/Core support)
	if err := zkp.Init(); err != nil {
		log.Warn().Err(err).Msg("Failed to initialize ZKP circuits (Running in Mock Mode)")
	} else {
		log.Info().Msg("ZKP Circuits initialized")
	}

	// Initialize Core Node (New Architecture)
	// Configuration is handled via Viper in NewNode()
	obscuraNode, err := node.NewNode()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize Obscura Node")
	}

	// Start Node
	// Run() handles all internal services (Jobs, AI, API, etc.)
	if err := obscuraNode.Run(); err != nil {
		log.Fatal().Err(err).Msg("Node runtime error")
	}
}
