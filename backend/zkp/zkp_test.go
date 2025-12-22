package zkp

import (
	"math/big"
	"testing"
)

func TestRangeProofGeneration(t *testing.T) {
	// Initialize ZKP system
	if err := Init(); err != nil {
		t.Fatalf("Failed to initialize ZKP: %v", err)
	}

	// Test values
	value := big.NewInt(150)
	min := big.NewInt(100)
	max := big.NewInt(200)

	// Generate proof
	proof, err := GenerateRangeProof(value, min, max)
	if err != nil {
		t.Fatalf("Failed to generate range proof: %v", err)
	}

	if proof == nil {
		t.Fatal("Proof is nil")
	}

	// Verify proof
	valid, err := VerifyRangeProof(proof, min, max)
	if err != nil {
		t.Fatalf("Failed to verify proof: %v", err)
	}

	if !valid {
		t.Fatal("Proof verification failed")
	}

	t.Log("✅ Range proof generation and verification successful")
}

func TestRangeProofOutOfBounds(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("Failed to initialize ZKP: %v", err)
	}

	// Value outside range
	value := big.NewInt(250)
	min := big.NewInt(100)
	max := big.NewInt(200)

	// This should fail during proof generation
	_, err := GenerateRangeProof(value, min, max)
	if err == nil {
		t.Fatal("Expected proof generation to fail for out-of-range value")
	}

	t.Log("✅ Out-of-bounds proof correctly rejected")
}

func TestProofSerialization(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("Failed to initialize ZKP: %v", err)
	}

	value := big.NewInt(150)
	min := big.NewInt(100)
	max := big.NewInt(200)

	proof, err := GenerateRangeProof(value, min, max)
	if err != nil {
		t.Fatalf("Failed to generate proof: %v", err)
	}

	// Serialize proof
	serialized, err := SerializeProof(proof)
	if err != nil {
		t.Fatalf("Failed to serialize proof: %v", err)
	}

	// Check serialization format (should be 8 big.Int values)
	if len(serialized) != 8 {
		t.Fatalf("Expected 8 serialized values, got %d", len(serialized))
	}

	for i, val := range serialized {
		if val == nil {
			t.Fatalf("Serialized value %d is nil", i)
		}
	}

	t.Log("✅ Proof serialization successful")
}

func TestVRFProofGeneration(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("Failed to initialize ZKP: %v", err)
	}

	secretKey := big.NewInt(12345)
	seed := big.NewInt(67890)
	// For simplified VRF circuit: randomness = secretKey + seed
	randomness := new(big.Int).Add(secretKey, seed)

	proof, err := GenerateVRFProof(secretKey, seed, randomness)
	if err != nil {
		t.Fatalf("Failed to generate VRF proof: %v", err)
	}

	if proof == nil {
		t.Fatal("VRF proof is nil")
	}

	t.Log("✅ VRF proof generation successful")
}

func TestBridgeProofGeneration(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("Failed to initialize ZKP: %v", err)
	}

	originChain := big.NewInt(1) // Ethereum
	secretKey := big.NewInt(99999)
	// For simplified bridge circuit: messageHash = originChain + secretKey
	msgHash := new(big.Int).Add(originChain, secretKey)

	proof, err := GenerateBridgeProof(msgHash, originChain, secretKey)
	if err != nil {
		t.Fatalf("Failed to generate bridge proof: %v", err)
	}

	if proof == nil {
		t.Fatal("Bridge proof is nil")
	}

	t.Log("✅ Bridge proof generation successful")
}
