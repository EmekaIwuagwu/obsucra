package pull

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"sync"
	"time"
)

// DataPoint represents a cached oracle data point
type DataPoint struct {
	FeedID       string    `json:"feed_id"`
	Value        *big.Int  `json:"value"`
	RoundID      uint64    `json:"round_id"`
	Timestamp    time.Time `json:"timestamp"`
	Decimals     uint8     `json:"decimals"`
	ZKProof      []byte    `json:"zk_proof,omitempty"`
	PublicInputs [2]*big.Int `json:"public_inputs,omitempty"`
	Hash         string    `json:"hash"`
}

// MerkleNode represents a node in the Merkle tree
type MerkleNode struct {
	Left  *MerkleNode
	Right *MerkleNode
	Hash  []byte
	Data  *DataPoint
}

// MerkleProof represents a proof of inclusion
type MerkleProof struct {
	DataPoint     *DataPoint `json:"data_point"`
	ProofPath     [][]byte   `json:"proof_path"`
	ProofPosition []bool     `json:"proof_position"` // true = right, false = left
	Root          []byte     `json:"root"`
	TreeHeight    int        `json:"tree_height"`
}

// MerkleCache stores data points with Merkle proof verification
type MerkleCache struct {
	mu         sync.RWMutex
	dataPoints map[string]*DataPoint // feedID -> latest data point
	history    map[string][]*DataPoint // feedID -> historical data points
	trees      map[string]*MerkleNode  // feedID -> Merkle tree root
	maxAge     time.Duration
	maxHistory int
}

// NewMerkleCache creates a new Merkle cache
func NewMerkleCache(maxAge time.Duration, maxHistory int) *MerkleCache {
	return &MerkleCache{
		dataPoints: make(map[string]*DataPoint),
		history:    make(map[string][]*DataPoint),
		trees:      make(map[string]*MerkleNode),
		maxAge:     maxAge,
		maxHistory: maxHistory,
	}
}

// Store adds a new data point to the cache
func (c *MerkleCache) Store(point *DataPoint) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Compute hash for this data point
	point.Hash = c.computeDataHash(point)

	// Store as latest
	c.dataPoints[point.FeedID] = point

	// Add to history
	if _, ok := c.history[point.FeedID]; !ok {
		c.history[point.FeedID] = make([]*DataPoint, 0, c.maxHistory)
	}
	c.history[point.FeedID] = append(c.history[point.FeedID], point)

	// Trim history if needed
	if len(c.history[point.FeedID]) > c.maxHistory {
		c.history[point.FeedID] = c.history[point.FeedID][len(c.history[point.FeedID])-c.maxHistory:]
	}

	// Rebuild Merkle tree for this feed
	c.rebuildTree(point.FeedID)

	return nil
}

// Get retrieves a data point with optional Merkle proof
func (c *MerkleCache) Get(feedID string, includeProof bool) (*DataPoint, *MerkleProof, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	point, ok := c.dataPoints[feedID]
	if !ok {
		return nil, nil, fmt.Errorf("feed not found: %s", feedID)
	}

	// Check if data is stale
	if time.Since(point.Timestamp) > c.maxAge {
		return nil, nil, fmt.Errorf("data too old: %v", time.Since(point.Timestamp))
	}

	if !includeProof {
		return point, nil, nil
	}

	// Generate Merkle proof
	proof, err := c.generateProof(feedID, point.Hash)
	if err != nil {
		return point, nil, err // Return data even if proof fails
	}

	return point, proof, nil
}

// GetWithMaxAge retrieves data with custom max age tolerance
func (c *MerkleCache) GetWithMaxAge(feedID string, maxAge time.Duration, includeProof bool) (*DataPoint, *MerkleProof, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	point, ok := c.dataPoints[feedID]
	if !ok {
		return nil, nil, fmt.Errorf("feed not found: %s", feedID)
	}

	if time.Since(point.Timestamp) > maxAge {
		return nil, nil, fmt.Errorf("data too old: %v > %v", time.Since(point.Timestamp), maxAge)
	}

	if !includeProof {
		return point, nil, nil
	}

	proof, err := c.generateProof(feedID, point.Hash)
	return point, proof, err
}

// GetHistory retrieves historical data points
func (c *MerkleCache) GetHistory(feedID string, limit int) ([]*DataPoint, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	history, ok := c.history[feedID]
	if !ok {
		return nil, fmt.Errorf("feed not found: %s", feedID)
	}

	if limit <= 0 || limit > len(history) {
		limit = len(history)
	}

	// Return most recent first
	result := make([]*DataPoint, limit)
	for i := 0; i < limit; i++ {
		result[i] = history[len(history)-1-i]
	}

	return result, nil
}

// VerifyProof verifies a Merkle proof
func (c *MerkleCache) VerifyProof(proof *MerkleProof) bool {
	if proof == nil || len(proof.ProofPath) != len(proof.ProofPosition) {
		return false
	}

	currentHash, _ := hex.DecodeString(proof.DataPoint.Hash)

	for i, sibling := range proof.ProofPath {
		var combined []byte
		if proof.ProofPosition[i] {
			combined = append(currentHash, sibling...)
		} else {
			combined = append(sibling, currentHash...)
		}
		h := sha256.Sum256(combined)
		currentHash = h[:]
	}

	return hex.EncodeToString(currentHash) == hex.EncodeToString(proof.Root)
}

// computeDataHash computes the hash of a data point
func (c *MerkleCache) computeDataHash(point *DataPoint) string {
	data := fmt.Sprintf("%s:%s:%d:%d",
		point.FeedID,
		point.Value.String(),
		point.RoundID,
		point.Timestamp.Unix(),
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// rebuildTree rebuilds the Merkle tree for a feed
func (c *MerkleCache) rebuildTree(feedID string) {
	history := c.history[feedID]
	if len(history) == 0 {
		return
	}

	// Create leaf nodes
	leaves := make([]*MerkleNode, len(history))
	for i, point := range history {
		hash, _ := hex.DecodeString(point.Hash)
		leaves[i] = &MerkleNode{
			Hash: hash,
			Data: point,
		}
	}

	// Build tree bottom-up
	c.trees[feedID] = c.buildTree(leaves)
}

// buildTree builds a Merkle tree from leaves
func (c *MerkleCache) buildTree(nodes []*MerkleNode) *MerkleNode {
	if len(nodes) == 0 {
		return nil
	}
	if len(nodes) == 1 {
		return nodes[0]
	}

	// Pad to even number of nodes if needed
	if len(nodes)%2 == 1 {
		nodes = append(nodes, nodes[len(nodes)-1])
	}

	var parents []*MerkleNode
	for i := 0; i < len(nodes); i += 2 {
		combined := append(nodes[i].Hash, nodes[i+1].Hash...)
		h := sha256.Sum256(combined)
		parent := &MerkleNode{
			Left:  nodes[i],
			Right: nodes[i+1],
			Hash:  h[:],
		}
		parents = append(parents, parent)
	}

	return c.buildTree(parents)
}

// generateProof generates a Merkle proof for a data point
func (c *MerkleCache) generateProof(feedID, dataHash string) (*MerkleProof, error) {
	root := c.trees[feedID]
	if root == nil {
		return nil, fmt.Errorf("no tree for feed: %s", feedID)
	}

	targetHash, _ := hex.DecodeString(dataHash)
	
	proofPath := [][]byte{}
	proofPosition := []bool{}

	// Find the leaf and build proof path
	found := c.findLeafPath(root, targetHash, &proofPath, &proofPosition)
	if !found {
		return nil, fmt.Errorf("data point not found in tree")
	}

	point := c.dataPoints[feedID]
	return &MerkleProof{
		DataPoint:     point,
		ProofPath:     proofPath,
		ProofPosition: proofPosition,
		Root:          root.Hash,
		TreeHeight:    len(proofPath),
	}, nil
}

// findLeafPath recursively finds a leaf and builds the proof path
func (c *MerkleCache) findLeafPath(node *MerkleNode, targetHash []byte, path *[][]byte, positions *[]bool) bool {
	if node == nil {
		return false
	}

	// Check if this is the target leaf
	if node.Left == nil && node.Right == nil {
		return hex.EncodeToString(node.Hash) == hex.EncodeToString(targetHash)
	}

	// Try left subtree
	if c.findLeafPath(node.Left, targetHash, path, positions) {
		if node.Right != nil {
			*path = append([][]byte{node.Right.Hash}, *path...)
			*positions = append([]bool{true}, *positions...)
		}
		return true
	}

	// Try right subtree
	if c.findLeafPath(node.Right, targetHash, path, positions) {
		if node.Left != nil {
			*path = append([][]byte{node.Left.Hash}, *path...)
			*positions = append([]bool{false}, *positions...)
		}
		return true
	}

	return false
}

// GetRoot returns the Merkle root for a feed
func (c *MerkleCache) GetRoot(feedID string) ([]byte, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	root, ok := c.trees[feedID]
	if !ok {
		return nil, fmt.Errorf("no tree for feed: %s", feedID)
	}

	return root.Hash, nil
}

// GetStats returns cache statistics
func (c *MerkleCache) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	feedStats := make(map[string]interface{})
	for feedID, points := range c.history {
		feedStats[feedID] = map[string]interface{}{
			"data_points": len(points),
			"latest_round": c.dataPoints[feedID].RoundID,
			"latest_time":  c.dataPoints[feedID].Timestamp,
		}
	}

	return map[string]interface{}{
		"total_feeds":   len(c.dataPoints),
		"max_age":       c.maxAge.String(),
		"max_history":   c.maxHistory,
		"feeds":         feedStats,
	}
}

// PullQueryHandler handles pull oracle queries
type PullQueryHandler struct {
	cache       *MerkleCache
	zkVerifier  ZKVerifier
	pricePerQuery *big.Int
}

// ZKVerifier interface for ZK proof verification
type ZKVerifier interface {
	VerifyRangeProof(proof []byte, min, max *big.Int) (bool, error)
}

// NewPullQueryHandler creates a new query handler
func NewPullQueryHandler(cache *MerkleCache, verifier ZKVerifier, pricePerQuery *big.Int) *PullQueryHandler {
	return &PullQueryHandler{
		cache:       cache,
		zkVerifier:  verifier,
		pricePerQuery: pricePerQuery,
	}
}

// QueryRequest represents a pull oracle query
type QueryRequest struct {
	FeedID       string        `json:"feed_id"`
	MaxAge       time.Duration `json:"max_age"`
	IncludeProof bool          `json:"include_proof"`
	IncludeZK    bool          `json:"include_zk"`
}

// QueryResponse represents the response to a pull query
type QueryResponse struct {
	FeedID       string        `json:"feed_id"`
	Value        string        `json:"value"`
	RoundID      uint64        `json:"round_id"`
	Timestamp    time.Time     `json:"timestamp"`
	Decimals     uint8         `json:"decimals"`
	MerkleProof  *MerkleProof  `json:"merkle_proof,omitempty"`
	ZKProof      []byte        `json:"zk_proof,omitempty"`
	PublicInputs []string      `json:"public_inputs,omitempty"`
	QueryCost    string        `json:"query_cost"`
}

// Query handles a pull oracle query
func (h *PullQueryHandler) Query(req *QueryRequest) (*QueryResponse, error) {
	if req.MaxAge == 0 {
		req.MaxAge = 60 * time.Second // Default 60s max age
	}

	point, proof, err := h.cache.GetWithMaxAge(req.FeedID, req.MaxAge, req.IncludeProof)
	if err != nil {
		return nil, err
	}

	response := &QueryResponse{
		FeedID:    point.FeedID,
		Value:     point.Value.String(),
		RoundID:   point.RoundID,
		Timestamp: point.Timestamp,
		Decimals:  point.Decimals,
		QueryCost: h.pricePerQuery.String(),
	}

	if proof != nil {
		response.MerkleProof = proof
	}

	if req.IncludeZK && len(point.ZKProof) > 0 {
		response.ZKProof = point.ZKProof
		if point.PublicInputs[0] != nil && point.PublicInputs[1] != nil {
			response.PublicInputs = []string{
				point.PublicInputs[0].String(),
				point.PublicInputs[1].String(),
			}
		}
	}

	return response, nil
}

// SerializeProof serializes a Merkle proof for on-chain verification
func SerializeProof(proof *MerkleProof) ([]byte, error) {
	return json.Marshal(proof)
}

// DeserializeProof deserializes a Merkle proof
func DeserializeProof(data []byte) (*MerkleProof, error) {
	var proof MerkleProof
	err := json.Unmarshal(data, &proof)
	return &proof, err
}
