package oracle

import (
	"sort"
)

// CalculateMedian returns the median of a slice of float64 values.
func CalculateMedian(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	// Work on a copy to avoid side effects
	data := make([]float64, len(values))
	copy(data, values)
	
	sort.Float64s(data)

	n := len(data)
	if n%2 == 1 {
		return data[n/2]
	}
	return (data[n/2-1] + data[n/2]) / 2
}
