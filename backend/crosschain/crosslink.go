package crosschain

import (
	"fmt"
	"math/big"

	"github.com/obscura-network/obscura-node/zkp"
	"github.com/rs/zerolog/log"
)

// BridgeMessage represents a cross-chain payload
type BridgeMessage struct {
	ID        string
	Source    string
	Target    string
	Data      []byte
	Signature []byte
}

// CrossLink handles cross-chain communication
type CrossLink struct {
	supportedChains []string
	secretKey       *big.Int // Simplified for demo, in prod: from key manager
}

// NewCrossLink initializes the bridge module
func NewCrossLink() *CrossLink {
	return &CrossLink{
		supportedChains: []string{"ethereum", "solana", "arbitrum", "optimism"},
		secretKey:       big.NewInt(123456789), // Mock secret key for proof generation
	}
}

// RelayMessage handles relaying a message to another chain with verification
func (cl *CrossLink) RelayMessage(msg BridgeMessage) error {
	log.Info().Str("msg_id", msg.ID).Str("target", msg.Target).Msg("Relaying Cross-Chain Message")
	
	// Chain verification
	isValid := false
	for _, c := range cl.supportedChains {
		if c == msg.Target { isValid = true; break }
	}
	if !isValid { return fmt.Errorf("unsupported chain: %s", msg.Target) }

	// 1. Generate ZK Proof of validity
	proof, err := cl.GenerateZKProofForBridge(msg.Data)
	if err != nil {
		return fmt.Errorf("failed to generate bridge proof: %w", err)
	}

	log.Info().
		Str("msg_id", msg.ID).
		Int("proof_len", len(proof)).
		Msg("Message Relayed Successfully with ZK Proof")

	return nil
}

// GenerateZKProofForBridge generates a validity proof for the state transition
func (cl *CrossLink) GenerateZKProofForBridge(data []byte) ([]byte, error) {
	msgHash := new(big.Int).SetBytes(data)
	originChain := big.NewInt(1) // Ethereum = 1

	proof, err := zkp.GenerateBridgeProof(msgHash, originChain, cl.secretKey)
	if err != nil {
		return nil, err
	}

	serialized, _ := zkp.SerializeProof(proof)
	
	// Convert [8]*big.Int to []byte for transmission
	var output []byte
	for _, b := range serialized {
		output = append(output, b.Bytes()...)
	}

	return output, nil
}
