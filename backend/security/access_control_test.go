package security

import (
	"testing"
	"time"
)

func TestAccessControllerWhitelist(t *testing.T) {
	ac := NewAccessController()

	// Add a consumer
	ac.AddConsumer("0x742d35Cc6634C0532925a3b844Bc9e7595f4e032", "DeFi Protocol A", TierPremium)

	// Check access for whitelisted consumer
	allowed, reason := ac.CheckAccess("0x742d35Cc6634C0532925a3b844Bc9e7595f4e032")
	if !allowed {
		t.Errorf("Expected access to be allowed, got denied: %s", reason)
	}

	// Check access for non-whitelisted consumer
	allowed, reason = ac.CheckAccess("0xunknownaddress")
	if allowed {
		t.Error("Expected access to be denied for non-whitelisted address")
	}
	if reason != "not_whitelisted" {
		t.Errorf("Expected reason 'not_whitelisted', got '%s'", reason)
	}

	t.Log("✅ Access control whitelist test passed")
}

func TestAccessControllerTiers(t *testing.T) {
	ac := NewAccessController()

	// Add consumers with different tiers
	ac.AddConsumer("0xFreeUser", "Free User", TierFree)
	ac.AddConsumer("0xPremiumUser", "Premium User", TierPremium)
	ac.AddConsumer("0xEnterpriseUser", "Enterprise User", TierEnterprise)

	// Verify rate limits are set correctly
	free, _ := ac.GetConsumer("0xFreeUser")
	if free.RateLimit != TierLimits[TierFree] {
		t.Errorf("Expected free tier limit %d, got %d", TierLimits[TierFree], free.RateLimit)
	}

	premium, _ := ac.GetConsumer("0xPremiumUser")
	if premium.RateLimit != TierLimits[TierPremium] {
		t.Errorf("Expected premium tier limit %d, got %d", TierLimits[TierPremium], premium.RateLimit)
	}

	enterprise, _ := ac.GetConsumer("0xEnterpriseUser")
	if enterprise.RateLimit != TierLimits[TierEnterprise] {
		t.Errorf("Expected enterprise tier limit %d, got %d", TierLimits[TierEnterprise], enterprise.RateLimit)
	}

	t.Log("✅ Access control tiers test passed")
}

func TestRateLimiting(t *testing.T) {
	ac := NewAccessController()

	// Add a consumer with very low rate limit for testing
	ac.AddConsumer("0xTestUser", "Test User", TierFree)

	// Get the consumer and verify rate limit
	consumer, _ := ac.GetConsumer("0xTestUser")
	limit := consumer.RateLimit // Should be 10 for free tier

	// Make requests up to the limit
	for i := 0; i < limit; i++ {
		allowed, _ := ac.CheckAccess("0xTestUser")
		if !allowed {
			t.Errorf("Request %d should be allowed (limit is %d)", i+1, limit)
		}
	}

	// Next request should be rate limited
	allowed, reason := ac.CheckAccess("0xTestUser")
	if allowed {
		t.Error("Expected request to be rate limited")
	}
	if reason != "rate_limit_exceeded" {
		t.Errorf("Expected reason 'rate_limit_exceeded', got '%s'", reason)
	}

	t.Log("✅ Rate limiting test passed")
}

func TestConsumerDeactivation(t *testing.T) {
	ac := NewAccessController()

	// Add and then deactivate a consumer
	ac.AddConsumer("0xTestUser", "Test User", TierStandard)

	// Should be allowed initially
	allowed, _ := ac.CheckAccess("0xTestUser")
	if !allowed {
		t.Error("Expected access to be allowed for active consumer")
	}

	// Deactivate
	ac.DeactivateConsumer("0xTestUser")

	// Should be denied now
	allowed, reason := ac.CheckAccess("0xTestUser")
	if allowed {
		t.Error("Expected access to be denied for deactivated consumer")
	}
	if reason != "consumer_deactivated" {
		t.Errorf("Expected reason 'consumer_deactivated', got '%s'", reason)
	}

	// Reactivate
	ac.ActivateConsumer("0xTestUser")

	// Should be allowed again
	allowed, _ = ac.CheckAccess("0xTestUser")
	if !allowed {
		t.Error("Expected access to be allowed after reactivation")
	}

	t.Log("✅ Consumer deactivation test passed")
}

func TestTierUpgrade(t *testing.T) {
	ac := NewAccessController()

	// Add a free tier consumer
	ac.AddConsumer("0xTestUser", "Test User", TierFree)

	// Verify initial tier
	consumer, _ := ac.GetConsumer("0xTestUser")
	if consumer.Tier != TierFree {
		t.Errorf("Expected TierFree, got %s", consumer.Tier)
	}

	// Upgrade to premium
	ac.UpdateTier("0xTestUser", TierPremium)

	// Verify upgrade
	consumer, _ = ac.GetConsumer("0xTestUser")
	if consumer.Tier != TierPremium {
		t.Errorf("Expected TierPremium, got %s", consumer.Tier)
	}
	if consumer.RateLimit != TierLimits[TierPremium] {
		t.Errorf("Expected rate limit %d, got %d", TierLimits[TierPremium], consumer.RateLimit)
	}

	t.Log("✅ Tier upgrade test passed")
}

func TestAccessControlDisabled(t *testing.T) {
	ac := NewAccessController()

	// Disable access control
	ac.Disable()

	// Any address should be allowed now
	allowed, reason := ac.CheckAccess("0xRandomUnknownAddress")
	if !allowed {
		t.Error("Expected access to be allowed when access control is disabled")
	}
	if reason != "access_control_disabled" {
		t.Errorf("Expected reason 'access_control_disabled', got '%s'", reason)
	}

	// Re-enable
	ac.Enable()

	// Should be denied again (not whitelisted)
	allowed, _ = ac.CheckAccess("0xRandomUnknownAddress")
	if allowed {
		t.Error("Expected access to be denied when access control is enabled")
	}

	t.Log("✅ Access control toggle test passed")
}

func TestRateLimiterQuota(t *testing.T) {
	rl := &RateLimiter{
		requests:    make([]time.Time, 0),
		windowSize:  time.Minute,
		maxRequests: 10,
	}

	// Initially should have full quota
	if rl.GetRemainingQuota() != 10 {
		t.Errorf("Expected 10 remaining quota, got %d", rl.GetRemainingQuota())
	}

	// Use some quota
	for i := 0; i < 3; i++ {
		rl.Allow()
	}

	// Should have 7 remaining
	if rl.GetRemainingQuota() != 7 {
		t.Errorf("Expected 7 remaining quota, got %d", rl.GetRemainingQuota())
	}

	// Current rate should be 3
	if rl.GetCurrentRate() != 3 {
		t.Errorf("Expected current rate of 3, got %d", rl.GetCurrentRate())
	}

	t.Log("✅ Rate limiter quota test passed")
}
