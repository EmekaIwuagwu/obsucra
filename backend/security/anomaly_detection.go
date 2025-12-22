package security

import (
	"math"
	"github.com/rs/zerolog/log"
)

// AnomalyDetector uses Z-Score analysis to identify outlier data points from oracle nodes.
type AnomalyDetector struct {
	Threshold float64 // Typically 2.0 or 3.0 for standard deviations
}

func NewAnomalyDetector(threshold float64) *AnomalyDetector {
	return &AnomalyDetector{Threshold: threshold}
}

// DetectOutliers returns the indices of values that are statistically significant outliers.
func (ad *AnomalyDetector) DetectOutliers(values []float64) []int {
	if len(values) < 3 {
		return nil
	}

	// Calculate Mean
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	// Calculate Standard Deviation
	var sqDiffSum float64
	for _, v := range values {
		sqDiffSum += math.Pow(v-mean, 2)
	}
	stdDev := math.Sqrt(sqDiffSum / float64(len(values)))

	if stdDev == 0 {
		return nil
	}

	var outliers []int
	for i, v := range values {
		zScore := math.Abs(v-mean) / stdDev
		if zScore > ad.Threshold {
			log.Warn().
				Float64("value", v).
				Float64("zScore", zScore).
				Msg("Anomaly detected in oracle data stream")
			outliers = append(outliers, i)
		}
	}

	return outliers
}

// DetectAndFilterAnomalies is a top-level helper to filter out outliers from a data set.
func DetectAndFilterAnomalies(values []float64, threshold float64) []float64 {
	detector := NewAnomalyDetector(threshold)
	outlierIndices := detector.DetectOutliers(values)
	
	if len(outlierIndices) == 0 {
		return values
	}

	outlierMap := make(map[int]bool)
	for _, idx := range outlierIndices {
		outlierMap[idx] = true
	}

	var cleaned []float64
	for i, v := range values {
		if !outlierMap[i] {
			cleaned = append(cleaned, v)
		}
	}
	return cleaned
}
