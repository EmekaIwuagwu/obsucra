package vrf

import (
	"testing"
)

func TestVRFGenerationAndVerification(t *testing.T) {
	// Initialize with empty key (ephemeral)
	rm := NewRandomnessManager("")
	
	seed := "obscura-test-seed-123"
	
	val, proof, err := rm.GenerateRandomness(seed)
	if err != nil {
		t.Fatalf("Generation error: %v", err)
	}
	if val == "" || proof == "" {
		t.Fatal("Value or proof is empty")
	}
	
	// Local verification
	if !rm.VerifyRandomness(seed, proof, val) {
		t.Error("VRF verification failed for correct seed")
	}
	
	// Tamper seed
	if rm.VerifyRandomness("wrong-seed", proof, val) {
		t.Error("VRF verification should have failed for wrong seed")
	}
}
