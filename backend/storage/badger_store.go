package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/dgraph-io/badger/v4"
	"github.com/rs/zerolog/log"
)

// BadgerStore implements the Store interface using BadgerDB
type BadgerStore struct {
	db   *badger.DB
	path string
}

// NewBadgerStore creates a new BadgerDB-backed store
func NewBadgerStore(path string) (*BadgerStore, error) {
	opts := badger.DefaultOptions(path)
	opts.Logger = nil // Disable BadgerDB's internal logging
	opts.SyncWrites = true // Ensure durability

	db, err := badger.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("failed to open BadgerDB: %w", err)
	}

	log.Info().Str("path", path).Msg("BadgerDB store initialized")

	// Start a goroutine for garbage collection
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			_ = db.RunValueLogGC(0.5)
		}
	}()

	return &BadgerStore{
		db:   db,
		path: path,
	}, nil
}

// Close closes the BadgerDB database
func (bs *BadgerStore) Close() error {
	return bs.db.Close()
}

// SaveJob stores a job with the given key
func (bs *BadgerStore) SaveJob(key string, job interface{}) error {
	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	return bs.db.Update(func(txn *badger.Txn) error {
		return txn.Set([]byte("job:"+key), data)
	})
}

// GetJob retrieves a job by key
func (bs *BadgerStore) GetJob(key string) (interface{}, bool) {
	var result interface{}
	
	err := bs.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte("job:" + key))
		if err != nil {
			return err
		}
		
		return item.Value(func(val []byte) error {
			return json.Unmarshal(val, &result)
		})
	})

	if err != nil {
		return nil, false
	}
	return result, true
}

// DeleteJob removes a job by key
func (bs *BadgerStore) DeleteJob(key string) error {
	return bs.db.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte("job:" + key))
	})
}

// GetAllJobs retrieves all jobs
func (bs *BadgerStore) GetAllJobs() map[string]interface{} {
	jobs := make(map[string]interface{})

	bs.db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Prefix = []byte("job:")
		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			key := string(item.Key())[4:] // Remove "job:" prefix
			
			item.Value(func(val []byte) error {
				var job interface{}
				if err := json.Unmarshal(val, &job); err == nil {
					jobs[key] = job
				}
				return nil
			})
		}
		return nil
	})

	return jobs
}

// SaveReputation stores a reputation score
func (bs *BadgerStore) SaveReputation(address string, score float64) error {
	data, err := json.Marshal(score)
	if err != nil {
		return err
	}

	return bs.db.Update(func(txn *badger.Txn) error {
		return txn.Set([]byte("reputation:"+address), data)
	})
}

// GetReputation retrieves a reputation score
func (bs *BadgerStore) GetReputation(address string) float64 {
	var score float64

	err := bs.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte("reputation:" + address))
		if err != nil {
			return err
		}
		
		return item.Value(func(val []byte) error {
			return json.Unmarshal(val, &score)
		})
	})

	if err != nil {
		return 50.0 // Default reputation
	}
	return score
}

// GetAllReputations retrieves all reputation scores
func (bs *BadgerStore) GetAllReputations() map[string]float64 {
	reputations := make(map[string]float64)

	bs.db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Prefix = []byte("reputation:")
		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			key := string(item.Key())[11:] // Remove "reputation:" prefix
			
			item.Value(func(val []byte) error {
				var score float64
				if err := json.Unmarshal(val, &score); err == nil {
					reputations[key] = score
				}
				return nil
			})
		}
		return nil
	})

	return reputations
}

// Set stores a generic key-value pair
func (bs *BadgerStore) Set(key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return bs.db.Update(func(txn *badger.Txn) error {
		return txn.Set([]byte("kv:"+key), data)
	})
}

// Get retrieves a generic value by key
func (bs *BadgerStore) Get(key string) (interface{}, bool) {
	var result interface{}

	err := bs.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte("kv:" + key))
		if err != nil {
			return err
		}
		
		return item.Value(func(val []byte) error {
			return json.Unmarshal(val, &result)
		})
	})

	if err != nil {
		return nil, false
	}
	return result, true
}

// Delete removes a key-value pair
func (bs *BadgerStore) Delete(key string) error {
	return bs.db.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte("kv:" + key))
	})
}

// SetWithTTL stores a value with a time-to-live
func (bs *BadgerStore) SetWithTTL(key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return bs.db.Update(func(txn *badger.Txn) error {
		e := badger.NewEntry([]byte("kv:"+key), data).WithTTL(ttl)
		return txn.SetEntry(e)
	})
}

// Clear removes all data from the store
func (bs *BadgerStore) Clear() error {
	return bs.db.DropAll()
}

// Stats returns database statistics
func (bs *BadgerStore) Stats() map[string]interface{} {
	lsm, vlog := bs.db.Size()
	
	return map[string]interface{}{
		"type":       "badger",
		"path":       bs.path,
		"lsm_size":   lsm,
		"vlog_size":  vlog,
		"total_size": lsm + vlog,
	}
}

// Backup creates a backup of the database
func (bs *BadgerStore) Backup(path string) error {
	// Create backup file using standard library
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	
	_, err = bs.db.Backup(f, 0)
	return err
}
