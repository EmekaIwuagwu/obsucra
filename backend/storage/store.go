package storage

import (
	"encoding/json"
	"os"
	"sync"

	"github.com/rs/zerolog/log"
)

// Store defines the persistence layer interface
type Store interface {
	SaveJob(id string, data interface{}) error
	GetJob(id string) (interface{}, bool)
	SaveReputation(nodeID string, score float64) error
	GetReputation(nodeID string) float64
	GetAllJobs() map[string]interface{}
	Close() error
}

// FileStore implements Store using a local JSON file
type FileStore struct {
	filename string
	mu       sync.RWMutex
	Data     struct {
		Jobs       map[string]interface{} `json:"jobs"`
		Reputation map[string]float64     `json:"reputation"`
	}
}

// NewFileStore creates or loads a file-based storage
func NewFileStore(filename string) (*FileStore, error) {
	fs := &FileStore{
		filename: filename,
	}
	fs.Data.Jobs = make(map[string]interface{})
	fs.Data.Reputation = make(map[string]float64)

	// Load existing data
	if _, err := os.Stat(filename); err == nil {
		file, err := os.ReadFile(filename)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(file, &fs.Data); err != nil {
			log.Warn().Err(err).Msg("Failed to decode store, starting empty")
		}
	}

	return fs, nil
}

func (fs *FileStore) SaveJob(id string, data interface{}) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.Data.Jobs[id] = data
	return fs.flush()
}

func (fs *FileStore) GetJob(id string) (interface{}, bool) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	val, ok := fs.Data.Jobs[id]
	return val, ok
}

func (fs *FileStore) SaveReputation(nodeID string, score float64) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.Data.Reputation[nodeID] = score
	return fs.flush()
}

func (fs *FileStore) GetReputation(nodeID string) float64 {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	val, ok := fs.Data.Reputation[nodeID]
	if !ok {
		return 50.0 // Default
	}
	return val
}

func (fs *FileStore) flush() error {
	data, err := json.MarshalIndent(fs.Data, "", "  ")
	if err != nil {
		return err
	}
	
	tempFile := fs.filename + ".tmp"
	if err := os.WriteFile(tempFile, data, 0644); err != nil {
		return err
	}
	
	// Finalize move
	if err := os.Rename(tempFile, fs.filename); err != nil {
		os.Remove(tempFile) // Cleanup
		return err
	}
	return nil
}

func (fs *FileStore) GetAllJobs() map[string]interface{} {
	fs.mu.RLock()
	defer fs.mu.RUnlock()
	
	// Return a copy to avoid race conditions
	copy := make(map[string]interface{})
	for k, v := range fs.Data.Jobs {
		copy[k] = v
	}
	return copy
}

func (fs *FileStore) Close() error {
	return fs.flush()
}
