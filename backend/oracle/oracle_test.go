package oracle

import (
	"testing"
)

func TestMedianAggregation(t *testing.T) {
	values := []float64{100, 200, 300, 400, 500}
	expected := float64(300)
	result := AggregateMedian(values)

	if result != expected {
		t.Errorf("Expected %f, got %f", expected, result)
	}
}

func TestMedianAggregationEven(t *testing.T) {
	values := []float64{100, 200, 300, 400}
	expected := float64(250) // (200 + 300) / 2
	result := AggregateMedian(values)

	if result != expected {
		t.Errorf("Expected %f, got %f", expected, result)
	}
}

func TestMedianWithOutliers(t *testing.T) {
	// 5000 is an extreme outlier (Z-score > 2.0)
	values := []float64{100, 105, 110, 115, 5000}
	expected := float64(107.5) // Median of {100, 105, 110, 115} is 107.5
	result := AggregateMedian(values)

	if result != expected {
		t.Errorf("Expected %f, got %f (outlier should be filtered)", expected, result)
	}
}
