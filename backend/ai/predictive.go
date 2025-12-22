package ai

import (
	"context"
	"math"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"gonum.org/v1/gonum/stat"
)

// PredictiveModel handles AI-based data feed forecasting
type PredictiveModel struct {
	history  map[string][]float64
	mu       sync.RWMutex
}

// NewPredictiveModel initializes the AI model
func NewPredictiveModel() *PredictiveModel {
	return &PredictiveModel{
		history: make(map[string][]float64),
	}
}

// AddDataPoint adds historical data for training/inference
func (pm *PredictiveModel) AddDataPoint(feedID string, value float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.history[feedID] = append(pm.history[feedID], value)
	
	// Keep window size manageable
	if len(pm.history[feedID]) > 1000 {
		pm.history[feedID] = pm.history[feedID][1:]
	}
}

// Forecast predicts the next value for a feed using Linear Regression
func (pm *PredictiveModel) Forecast(feedID string) (float64, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	data, ok := pm.history[feedID]
	if !ok || len(data) < 2 {
		return 0, nil
	}

	// Create X axis (0, 1, 2...)
	xs := make([]float64, len(data))
	for i := range xs {
		xs[i] = float64(i)
	}

	// Calculate Linear Regression: y = alpha + beta*x
	alpha, beta := stat.LinearRegression(xs, data, nil, false)

	// Predict next value (x = len(data))
	prediction := alpha + beta*float64(len(data))

	return prediction, nil
}

// PredictVolatility calculates the standard deviation of recent prices
func (pm *PredictiveModel) PredictVolatility(feedID string) float64 {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	
	data, ok := pm.history[feedID]
	if !ok || len(data) < 2 {
		return 0
	}

	// Calculate Mean
	var sum float64
	for _, v := range data {
		sum += v
	}
	mean := sum / float64(len(data))

	// Calculate Variance
	var varianceSum float64
	for _, v := range data {
		varianceSum += math.Pow(v-mean, 2)
	}
	variance := varianceSum / float64(len(data)) // Population variance

	return math.Sqrt(variance)
}

// RunTrainingLoop periodically retrains models or updates parameters
func (pm *PredictiveModel) RunTrainingLoop(ctx context.Context) {
	log.Info().Msg("AI Predictive Model Training Loop Started")
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Stopping AI Training Loop")
			return
		case <-ticker.C:
			// Perform batch training or optimization here
			// log.Debug().Msg("Retraining models on latest data...")
		}
	}
}
