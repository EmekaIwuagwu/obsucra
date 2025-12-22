package security

import (
	"testing"
)

func TestAnomalyDetectionMAD(t *testing.T) {
	// 500.0 is a clear outlier
	values := []float64{100.0, 102.0, 98.0, 101.0, 100.5, 500.0}
	
	// With threshold 4.0, 500.0 should be filtered but 98.0 (z~3.3) should stay
	cleaned := DetectAndFilterAnomalies(values, 4.0)
	
	if len(cleaned) != 5 {
		t.Errorf("Expected 5 values, got %d. Outlier was not filtered.", len(cleaned))
	}
	
	for _, v := range cleaned {
		if v == 500.0 {
			t.Error("Outlier 500.0 still present in cleaned data")
		}
	}
}

func TestAnomalyDetectionIdentical(t *testing.T) {
	values := []float64{100.0, 100.0, 100.0}
	cleaned := DetectAndFilterAnomalies(values, 3.0)
	if len(cleaned) != 3 {
		t.Error("Filtered identical values unexpectedly")
	}
}
