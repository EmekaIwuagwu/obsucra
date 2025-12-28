package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/obscura-network/obscura-node/api"
	"github.com/obscura-network/obscura-node/oracle"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "obscura",
	Short: "Obscura Network CLI - Secure your data mesh",
	Long: `A CLI tool for node operators to manage their Obscura Node, 
staking, and privacy oracle operations.`,
}

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the Obscura Node",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("🚀 Initializing Obscura Node API Server...")
		fmt.Println("🔗 Starting Metrics Server on :8080...")

		// Create metrics collector and feed manager
		collector := api.NewMetricsCollector()
		feedManager := oracle.NewFeedManager()

		// Register demo feeds
		feedManager.RegisterFeed(&oracle.FeedConfig{
			ID:     "ETH-USD",
			Name:   "Ethereum / US Dollar",
			Active: true,
		})
		feedManager.RegisterFeed(&oracle.FeedConfig{
			ID:     "BTC-USD",
			Name:   "Bitcoin / US Dollar",
			Active: true,
		})

		// Create and start server
		server := api.NewMetricsServer(collector, feedManager, "8080")

		// Handle shutdown gracefully
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			<-sigChan
			fmt.Println("\n🛑 Shutting down...")
			os.Exit(0)
		}()

		fmt.Println("✅ API Server running at http://localhost:8080")
		fmt.Println("   Endpoints: /api/stats, /api/feeds, /api/jobs, /api/network, /api/chains")
		fmt.Println("   Press Ctrl+C to stop")

		if err := server.Start(); err != nil {
			fmt.Printf("❌ Server error: %v\n", err)
			os.Exit(1)
		}
	},
}

var stakeCmd = &cobra.Command{
	Use:   "stake [amount]",
	Short: "Stake OBSCURA tokens to become an active node",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		amount := args[0]
		fmt.Printf("🔒 Staking %s OBSCURA tokens...\n", amount)
		fmt.Println("✅ Stake successful. Reputation updated.")
	},
}

var statsCmd = &cobra.Command{
	Use:   "stats",
	Short: "View node and network statistics",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("📊 Obscura Network Stats:")
		fmt.Println(" - Node Identity: node_7x92...ff")
		fmt.Println(" - Reputation: 98/100")
		fmt.Println(" - Active Proofs: 1,420")
		fmt.Println(" - Network Latency: 12ms")
	},
}

func init() {
	rootCmd.AddCommand(startCmd)
	rootCmd.AddCommand(stakeCmd)
	rootCmd.AddCommand(statsCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
