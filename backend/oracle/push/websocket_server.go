package push

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

// PriceUpdate represents a real-time price update
type PriceUpdate struct {
	FeedID      string    `json:"feed_id"`
	Value       string    `json:"value"`
	RoundID     uint64    `json:"round_id"`
	Timestamp   time.Time `json:"timestamp"`
	Decimals    uint8     `json:"decimals"`
	Confidence  float64   `json:"confidence"`
	IsZKVerified bool     `json:"zk_verified"`
	Latency     int64     `json:"latency_ms"`
	Signature   string    `json:"signature,omitempty"`
}

// Subscription represents a client subscription
type Subscription struct {
	ID         string
	ClientID   string
	FeedIDs    []string
	APIKey     string
	IsPremium  bool
	CreatedAt  time.Time
	LastUpdate time.Time
}

// Client represents a connected WebSocket client
type Client struct {
	ID           string
	Conn         *websocket.Conn
	Subscription *Subscription
	SendChan     chan []byte
	Done         chan struct{}
}

// WebSocketServer handles push oracle connections
type WebSocketServer struct {
	mu          sync.RWMutex
	clients     map[string]*Client
	subscriptions map[string]map[string]*Client // feedID -> clientID -> client
	upgrader    websocket.Upgrader
	broadcast   chan *PriceUpdate
	register    chan *Client
	unregister  chan *Client
	
	// Metrics
	totalConnections   uint64
	totalUpdates       uint64
	avgLatency         float64
}

// NewWebSocketServer creates a new push oracle server
func NewWebSocketServer() *WebSocketServer {
	return &WebSocketServer{
		clients:       make(map[string]*Client),
		subscriptions: make(map[string]map[string]*Client),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Configure properly for production
			},
		},
		broadcast:   make(chan *PriceUpdate, 1000),
		register:    make(chan *Client, 100),
		unregister:  make(chan *Client, 100),
	}
}

// Start begins the WebSocket server
func (s *WebSocketServer) Start(ctx context.Context, addr string) error {
	// Start broadcast loop
	go s.runBroadcastLoop(ctx)
	
	// Setup HTTP handlers
	http.HandleFunc("/ws/v1/prices", s.handleWebSocket)
	http.HandleFunc("/ws/v1/health", s.handleHealth)
	
	log.Info().Str("addr", addr).Msg("Push oracle WebSocket server starting")
	
	server := &http.Server{
		Addr:         addr,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	
	go func() {
		<-ctx.Done()
		server.Shutdown(context.Background())
	}()
	
	return server.ListenAndServe()
}

// handleWebSocket handles new WebSocket connections
func (s *WebSocketServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Extract API key
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		apiKey = r.URL.Query().Get("api_key")
	}
	
	// Upgrade connection
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}
	
	// Create client
	client := &Client{
		ID:       fmt.Sprintf("client-%d", time.Now().UnixNano()),
		Conn:     conn,
		SendChan: make(chan []byte, 256),
		Done:     make(chan struct{}),
		Subscription: &Subscription{
			ID:        fmt.Sprintf("sub-%d", time.Now().UnixNano()),
			ClientID:  "",
			APIKey:    apiKey,
			IsPremium: s.isPremiumKey(apiKey),
			CreatedAt: time.Now(),
		},
	}
	
	s.register <- client
	
	// Start read/write loops
	go s.writePump(client)
	go s.readPump(client)
}

// handleHealth returns server health
func (s *WebSocketServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	clientCount := len(s.clients)
	s.mu.RUnlock()
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "healthy",
		"clients":       clientCount,
		"total_updates": s.totalUpdates,
		"avg_latency":   s.avgLatency,
	})
}

// runBroadcastLoop handles message broadcasting
func (s *WebSocketServer) runBroadcastLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
			
		case client := <-s.register:
			s.mu.Lock()
			s.clients[client.ID] = client
			s.totalConnections++
			s.mu.Unlock()
			
			log.Info().
				Str("clientId", client.ID).
				Bool("premium", client.Subscription.IsPremium).
				Msg("Client connected")
			
		case client := <-s.unregister:
			s.mu.Lock()
			if _, ok := s.clients[client.ID]; ok {
				delete(s.clients, client.ID)
				close(client.SendChan)
				
				// Remove from feed subscriptions
				for feedID, subs := range s.subscriptions {
					delete(subs, client.ID)
					if len(subs) == 0 {
						delete(s.subscriptions, feedID)
					}
				}
			}
			s.mu.Unlock()
			
			log.Info().Str("clientId", client.ID).Msg("Client disconnected")
			
		case update := <-s.broadcast:
			s.broadcastUpdate(update)
		}
	}
}

// broadcastUpdate sends an update to all subscribed clients
func (s *WebSocketServer) broadcastUpdate(update *PriceUpdate) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	// Get clients subscribed to this feed
	subscribers, ok := s.subscriptions[update.FeedID]
	if !ok {
		return
	}
	
	data, err := json.Marshal(update)
	if err != nil {
		return
	}
	
	for _, client := range subscribers {
		select {
		case client.SendChan <- data:
			s.totalUpdates++
		default:
			// Client buffer full, skip this update
			log.Warn().Str("clientId", client.ID).Msg("Client buffer full, dropping update")
		}
	}
}

// readPump handles incoming messages from clients
func (s *WebSocketServer) readPump(client *Client) {
	defer func() {
		s.unregister <- client
		client.Conn.Close()
	}()
	
	client.Conn.SetReadLimit(4096)
	client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.Conn.SetPongHandler(func(string) error {
		client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	for {
		_, message, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error().Err(err).Msg("WebSocket read error")
			}
			break
		}
		
		s.handleMessage(client, message)
	}
}

// writePump handles outgoing messages to clients
func (s *WebSocketServer) writePump(client *Client) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		client.Conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-client.SendChan:
			client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			w, err := client.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			
			// Add queued messages to the current websocket message
			n := len(client.SendChan)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-client.SendChan)
			}
			
			if err := w.Close(); err != nil {
				return
			}
			
		case <-ticker.C:
			client.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
			
		case <-client.Done:
			return
		}
	}
}

// SubscribeMessage represents a subscription request
type SubscribeMessage struct {
	Action  string   `json:"action"` // "subscribe" or "unsubscribe"
	FeedIDs []string `json:"feed_ids"`
}

// handleMessage processes incoming client messages
func (s *WebSocketServer) handleMessage(client *Client, message []byte) {
	var msg SubscribeMessage
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Error().Err(err).Msg("Failed to parse message")
		return
	}
	
	s.mu.Lock()
	defer s.mu.Unlock()
	
	switch msg.Action {
	case "subscribe":
		for _, feedID := range msg.FeedIDs {
			if _, ok := s.subscriptions[feedID]; !ok {
				s.subscriptions[feedID] = make(map[string]*Client)
			}
			s.subscriptions[feedID][client.ID] = client
		}
		client.Subscription.FeedIDs = append(client.Subscription.FeedIDs, msg.FeedIDs...)
		
		log.Info().
			Str("clientId", client.ID).
			Strs("feeds", msg.FeedIDs).
			Msg("Client subscribed to feeds")
		
	case "unsubscribe":
		for _, feedID := range msg.FeedIDs {
			if subs, ok := s.subscriptions[feedID]; ok {
				delete(subs, client.ID)
			}
		}
	}
}

// PublishUpdate publishes a price update to subscribers
func (s *WebSocketServer) PublishUpdate(update *PriceUpdate) {
	select {
	case s.broadcast <- update:
	default:
		log.Warn().Str("feed", update.FeedID).Msg("Broadcast buffer full")
	}
}

// isPremiumKey checks if API key has premium access
func (s *WebSocketServer) isPremiumKey(apiKey string) bool {
	// In production, check against database
	return len(apiKey) > 0
}

// GetMetrics returns server metrics
func (s *WebSocketServer) GetMetrics() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	feedCounts := make(map[string]int)
	for feedID, clients := range s.subscriptions {
		feedCounts[feedID] = len(clients)
	}
	
	return map[string]interface{}{
		"connected_clients":    len(s.clients),
		"total_connections":    s.totalConnections,
		"total_updates":        s.totalUpdates,
		"avg_latency_ms":       s.avgLatency,
		"subscriptions_by_feed": feedCounts,
	}
}

// LatencyTracker tracks update latency
type LatencyTracker struct {
	mu       sync.Mutex
	samples  []int64
	maxSamples int
}

// NewLatencyTracker creates a new latency tracker
func NewLatencyTracker(maxSamples int) *LatencyTracker {
	return &LatencyTracker{
		samples:    make([]int64, 0, maxSamples),
		maxSamples: maxSamples,
	}
}

// Record records a latency sample
func (t *LatencyTracker) Record(latencyMs int64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	if len(t.samples) >= t.maxSamples {
		t.samples = t.samples[1:]
	}
	t.samples = append(t.samples, latencyMs)
}

// Average returns the average latency
func (t *LatencyTracker) Average() float64 {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	if len(t.samples) == 0 {
		return 0
	}
	
	var sum int64
	for _, s := range t.samples {
		sum += s
	}
	return float64(sum) / float64(len(t.samples))
}

// P95 returns the 95th percentile latency
func (t *LatencyTracker) P95() int64 {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	if len(t.samples) == 0 {
		return 0
	}
	
	// Simple implementation - in production use more efficient algorithm
	sorted := make([]int64, len(t.samples))
	copy(sorted, t.samples)
	
	// Bubble sort for simplicity
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	
	idx := int(float64(len(sorted)) * 0.95)
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}
