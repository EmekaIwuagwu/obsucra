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
