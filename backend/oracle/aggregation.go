package oracle

import (
	"sort"

	"github.com/obscura-network/obscura-node/security"
)

// AggregateMedian returns the median of a slice of float64 values after filtering outliers.
func AggregateMedian(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	// Filter outliers using Z-Score (from security package)
	filtered := security.DetectAndFilterAnomalies(values, 1.5)
	if len(filtered) == 0 {
		filtered = values // Fallback to raw if all filtered
	}

	// Work on a copy to avoid side effects
	data := make([]float64, len(filtered))
	copy(data, filtered)
	
	sort.Float64s(data)

	n := len(data)
	if n%2 == 1 {
		return data[n/2]
	}
	return (data[n/2-1] + data[n/2]) / 2
}
