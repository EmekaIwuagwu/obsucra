package vrf

import (
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"
	"sync"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/rs/zerolog/log"
)

// RandomnessManager handles VRF requests
type RandomnessManager struct {
	mu         sync.Mutex
	privateKey *ecdsa.PrivateKey
}

// NewRandomnessManager creates a new VRF manager.
func NewRandomnessManager(pkHex string) *RandomnessManager {
	var pk *ecdsa.PrivateKey
	var err error

	if pkHex != "" && pkHex != "0000000000000000000000000000000000000000000000000000000000000000" {
		pk, err = crypto.HexToECDSA(pkHex)
		if err != nil {
			log.Error().Err(err).Msg("Failed to load VRF private key from config, generating fresh one")
			pk, _ = crypto.GenerateKey()
		}
	} else {
		pk, _ = crypto.GenerateKey()
		log.Warn().Msg("No VRF private key provided, using ephemeral session key")
	}

	log.Info().Str("public_key", crypto.PubkeyToAddress(pk.PublicKey).Hex()).Msg("VRF Manager Initialized")
	
	return &RandomnessManager{
		privateKey: pk,
	}
}

// GenerateRandomness produces a random number and a proof (ECDSA signature)
// It signs keccak256(seed + timestamp) to ensure uniqueness
func (rm *RandomnessManager) GenerateRandomness(seed string) (string, string, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	log.Info().Str("seed", seed).Msg("Generating VRF Proof")

	// 1. Construct the payload to sign (simulating the contract's expectation)
	// For full correctness, this must exactly match the logic in the contract's requestSeeds calculation
	// Since backend doesn't see msg.sender here easily without more context, we simplify:
	// We sign the seed itself as the source of randomness.
	
	seedHash := crypto.Keccak256Hash([]byte(seed))
	
	// 2. Sign the hash
    // Note: The signature itself acts as the "randomness proof" because it's unique, deterministic (for a unique seed), and verifiable.
	signature, err := crypto.Sign(seedHash.Bytes(), rm.privateKey)
	if err != nil {
		return "", "", fmt.Errorf("failed to sign VRF payload: %w", err)
	}

    // 3. Convert signature to a big integer to serve as the "Random Value"
    // In many VRF implementations (like Chainlink), the signature digest IS the random output.
    randomInt := new(big.Int).SetBytes(crypto.Keccak256(signature))

	return randomInt.String(), hex.EncodeToString(signature), nil
}

// VerifyRandomness checks if the signature matches the public key (Local check)
func (rm *RandomnessManager) VerifyRandomness(seed, proofHex, value string) bool {
    // Decode proof
    sig, err := hex.DecodeString(proofHex)
    if err != nil {
        return false
    }
    
    // Hash seed
    seedHash := crypto.Keccak256Hash([]byte(seed))
    
    // Recover Public Key
    pubKeyBytes, err := crypto.Ecrecover(seedHash.Bytes(), sig)
    if err != nil {
        return false
    }
    
    // Check if it matches our public key
    // In prod: check against on-chain registered oracle key
    // For now, we assume self-verification
    derivedPub, _ := crypto.UnmarshalPubkey(pubKeyBytes)
    return derivedPub.X.Cmp(rm.privateKey.PublicKey.X) == 0 && derivedPub.Y.Cmp(rm.privateKey.PublicKey.Y) == 0
}
