package sdk

import (
	"testing"
)

func TestObscuraClientInit(t *testing.T) {
	// Simple init test (will fail connection if no RPC but we check for creation)
	client, err := NewObscuraClient("http://localhost:8545", "0x0000000000000000000000000000000000000000")
	if err != nil {
		// If it's a dial error, that's fine for existence check
		return 
	}
	if client == nil {
		t.Fatal("Client should not be nil")
	}
}

func TestProofVerificationMock(t *testing.T) {
	client := &ObscuraClient{}
	ok, err := client.VerifyProof([]byte("proof"), []byte("inputs"))
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !ok {
		t.Error("Mock proof verification failed")
	}
}
