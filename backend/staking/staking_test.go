package staking

import (
	"testing"
)

func TestStakeGuardInit(t *testing.T) {
	sg := NewStakeGuard()
	if sg == nil {
		t.Fatal("StakeGuard should not be nil")
	}
}
