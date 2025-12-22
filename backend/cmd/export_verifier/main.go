package main

import (
	"log"
	"github.com/obscura-network/obscura-node/zkp"
)

func main() {
	err := zkp.ExportSolidityContract("../contracts/Verifier.sol")
	if err != nil {
		log.Fatalf("Failed to export verifier: %v", err)
	}
	log.Println("Verifier.sol exported successfully to contracts folder.")
}
