package oracle

import (
	"testing"
)

func TestMedianAggregation(t *testing.T) {
	values := []uint64{100, 200, 300, 400, 500}
	expected := uint64(300)
	result := AggregateMedian(values)

	if result != expected {
		t.Errorf("Expected %d, got %d", expected, result)
	}
}

func TestMedianAggregationEven(t *testing.T) {
	values := []uint64{100, 200, 300, 400}
	expected := uint64(250) // (200 + 300) / 2
	result := AggregateMedian(values)

	if result != expected {
		t.Errorf("Expected %d, got %d", expected, result)
	}
}
