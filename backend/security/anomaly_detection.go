package security

import (
	"sort"

	"github.com/rs/zerolog/log"
	"gonum.org/v1/gonum/stat"
)

// DetectAndFilterAnomalies identifies and removes outliers using the 
// Median Absolute Deviation (MAD) method, which is more robust than Z-Score.
func DetectAndFilterAnomalies(values []float64, threshold float64) []float64 {
	if len(values) < 3 {
		return values
	}

	// 1. Calculate Median
	data := make([]float64, len(values))
	copy(data, values)
	sort.Float64s(data)
	
	median := stat.Quantile(0.5, stat.Empirical, data, nil)

	// 2. Calculate MAD (Median Absolute Deviation)
	absDeviations := make([]float64, len(values))
	for i, v := range values {
		dev := v - median
		if dev < 0 {
			dev = -dev
		}
		absDeviations[i] = dev
	}
	sort.Float64s(absDeviations)
	mad := stat.Quantile(0.5, stat.Empirical, absDeviations, nil)

	if mad == 0 {
		return values // Avoid division by zero if all values are identical
	}

	// 3. Filter using Modified Z-Score
	// Standard constant 0.6745 is used to make MAD consistent with standard deviation
	var cleaned []float64
	for _, v := range values {
		modifiedZ := 0.6745 * (v - median) / mad
		if modifiedZ < 0 {
			modifiedZ = -modifiedZ
		}

		if modifiedZ <= threshold {
			cleaned = append(cleaned, v)
		} else {
			log.Warn().
				Float64("value", v).
				Float64("modified_z", modifiedZ).
				Msg("Statistical outlier detected and filtered via MAD")
		}
	}

	if len(cleaned) == 0 {
		return values
	}

	return cleaned
}
