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

// GenerateRandomness produces a deterministic random number and a proof from a seed.
// This implementation uses RFC 6979 deterministic signatures (provided by libsecp256k1 via Geth)
// to ensure that for a given seed and private key, exactly one valid signature/random-value exists.
func (rm *RandomnessManager) GenerateRandomness(seed string) (string, string, error) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// 1. Prepare entropy from seed
	// We hash the seed to ensure we have a standard 32-byte input
	seedHash := crypto.Keccak256Hash([]byte(seed))
	
	// 2. Generate the deterministic signature
	// The crypto.Sign function in Geth uses secp256k1 which is deterministic by default.
	signature, err := crypto.Sign(seedHash.Bytes(), rm.privateKey)
	if err != nil {
		log.Error().Err(err).Msg("VRF signature generation failed")
		return "", "", fmt.Errorf("cryptographic failure: %w", err)
	}

	// 3. Derive the Random Value from the signature
	// We hash the signature to produce the final VRF output.
	// This ensures the value is indistinguishable from random data to anyone without the private key.
	randomValue := crypto.Keccak256Hash(signature)
	randomInt := new(big.Int).SetBytes(randomValue.Bytes())

	log.Info().
		Str("seed", seed).
		Str("random_val", randomInt.String()[:10]+"...").
		Msg("Deterministic VRF output generated")

	return randomInt.String(), hex.EncodeToString(signature), nil
}

// VerifyRandomness performs a local verification of the VRF output.
func (rm *RandomnessManager) VerifyRandomness(seed, proofHex, value string) bool {
	sig, err := hex.DecodeString(proofHex)
	if err != nil {
		return false
	}

	seedHash := crypto.Keccak256Hash([]byte(seed))
	
	// Recover the public key from the signature to prove the source
	pubKey, err := crypto.SigToPub(seedHash.Bytes(), sig)
	if err != nil {
		return false
	}

	// Assert the public key matches the manager's authorized key
	if crypto.PubkeyToAddress(*pubKey) != crypto.PubkeyToAddress(rm.privateKey.PublicKey) {
		return false
	}

	// Verify the hash of the signature matches the provided value
	expectedValue := crypto.Keccak256Hash(sig)
	providedValue, ok := new(big.Int).SetString(value, 10)
	if !ok {
		return false
	}

	return expectedValue.Big().Cmp(providedValue) == 0
}
