# Obscura Oracle - Detailed Implementation Plan

**Current Status:** 85% Production-Ready  
**Target:** 100% Production-Ready (Chainlink-Grade)  
**Estimated Timeline:** 10-14 days

---

## Phase 2: Integration & Hardening (Days 1-7)

### Day 1: Reorg Protection Integration

**File:** `backend/node/listener.go`

**Changes:**
```go
// Add to EventListener struct
type EventListener struct {
    JobManager   *JobManager
    RPCEndpoint  string
    ContractAddr common.Address
    client       *ethclient.Client
    oracleABI    abi.ABI
    reorgProtector *ReorgProtector  // NEW
}

// Update NewEventListener
func NewEventListener(jm *JobManager, rpc string, contractAddr string, store storage.Store) (*EventListener, error) {
    // ... existing code ...
    
    reorgProtector, err := NewReorgProtector(client, store, 12) // 12 block confirmation
    if err != nil {
        return nil, err
    }
    
    return &EventListener{
        // ... existing fields ...
        reorgProtector: reorgProtector,
    }, nil
}

// Update handleLog
func (el *EventListener) handleLog(vLog types.Log) {
    // Check if should process (not a reorg duplicate)
    shouldProcess, err := el.reorgProtector.ShouldProcessEvent(
        vLog.BlockNumber,
        vLog.TxHash,
        vLog.Index,
    )
    if err != nil {
        log.Error().Err(err).Msg("Reorg check failed")
        return
    }
    if !shouldProcess {
        return // Skip duplicate or unconfirmed event
    }
    
    // ... existing event processing ...
    
    // Mark as processed
    el.reorgProtector.MarkEventProcessed(vLog.BlockNumber, vLog.TxHash, vLog.Index)
}
```

**Testing:**
- Simulate reorg on local testnet
- Verify events not double-processed
- Check last processed block persistence

---

### Day 2: Job Persistence Integration

**File:** `backend/node/jobs.go`

**Changes:**
```go
// Add to JobManager struct
type JobManager struct {
    JobQueue    chan oracle.JobRequest
    mu          sync.RWMutex
    adapters    *adapters.AdapterManager
    txMgr       *TxManager
    vrfMgr      *vrf.RandomnessManager
    repMgr      *security.ReputationManager
    computeMgr  *functions.ComputeManager
    oracleAddr  common.Address
    oracleABI   abi.ABI
    persistence *JobPersistence  // NEW
    retryQueue  *RetryQueue      // NEW
}

// Update Dispatch
func (jm *JobManager) Dispatch(job oracle.JobRequest) {
    // Save to persistent storage
    if err := jm.persistence.SavePendingJob(job); err != nil {
        log.Error().Err(err).Str("job_id", job.ID).Msg("Failed to persist job")
    }
    
    jm.JobQueue <- job
    log.Info().Str("job_id", job.ID).Str("type", string(job.Type)).Msg("Job submitted")
}

// Update processJob
func (jm *JobManager) processJob(ctx context.Context, job oracle.JobRequest) {
    log.Info().Str("job_id", job.ID).Str("type", string(job.Type)).Msg("Processing Job")
    
    var err error
    switch job.Type {
    case oracle.JobTypeDataFeed:
        err = jm.handleDataFeedWithRetry(ctx, job)
    case oracle.JobTypeVRF:
        err = jm.handleVRFWithRetry(ctx, job)
    case oracle.JobTypeCompute:
        err = jm.handleComputeWithRetry(ctx, job)
    default:
        log.Warn().Str("type", string(job.Type)).Msg("Unknown job type")
        return
    }
    
    if err != nil {
        // Add to retry queue
        jm.retryQueue.AddToRetryQueue(job, err.Error())
    } else {
        // Mark as completed
        jm.persistence.MarkJobCompleted(job.ID)
    }
}

// Add retry wrappers
func (jm *JobManager) handleDataFeedWithRetry(ctx context.Context, job oracle.JobRequest) error {
    // Wrap existing handleDataFeed with error return
    // ... implementation ...
}
```

**Testing:**
- Kill node mid-processing
- Restart and verify job recovery
- Test retry queue with failing jobs

---

### Day 3-4: Feed Manager Integration

**File:** `backend/node/listener.go` and `backend/node/node.go`

**Changes:**

1. **Add FeedManager to Node:**
```go
// In node.go
type Node struct {
    Config     Config
    Logger     zerolog.Logger
    JobManager *JobManager
    Adapters   *adapters.AdapterManager
    Security   *security.ReputationManager
    Storage    storage.Store
    VRF        *vrf.RandomnessManager
    AI         *ai.PredictiveModel
    Automation *automation.TriggerManager
    Bridge     *crosschain.CrossLink
    StakeGuard *staking.StakeGuard
    StakeSync  *StakeSync
    Listener   *EventListener
    FeedManager *oracle.FeedManager  // NEW
}

// In NewNode()
feedMgr := oracle.NewFeedManager()

// Register default feeds
feedMgr.RegisterFeed(&oracle.FeedConfig{
    ID:                "ETH-USD",
    Name:              "Ethereum / US Dollar",
    Decimals:          8,
    MinResponses:      3,
    MaxResponses:      10,
    DeviationThreshold: big.NewInt(50), // 0.5%
    HeartbeatInterval: 1 * time.Hour,
    OracleAddresses:   []string{/* node addresses */},
    DataSources: []oracle.DataSource{
        {URL: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", Path: "ethereum.usd"},
        {URL: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", Path: "price"},
    },
    AggregationMethod: "median",
    Active:            true,
})
```

2. **Update Listener to use FeedManager:**
```go
// In handleLog for RequestData event
case "RequestData":
    // ... existing parsing ...
    
    feedID := vals[4].(string) // Assume feed ID added to event
    feed, exists := el.FeedManager.GetFeed(feedID)
    if !exists {
        log.Warn().Str("feed_id", feedID).Msg("Unknown feed")
        return
    }
    
    // Use feed configuration
    el.JobManager.Dispatch(oracle.JobRequest{
        ID:        id,
        Type:      oracle.JobTypeDataFeed,
        Params:    map[string]interface{}{
            "feed_id": feedID,
            "data_sources": feed.DataSources,
            "min_responses": feed.MinResponses,
            "aggregation": feed.AggregationMethod,
        },
        Requester: requester.Hex(),
        Timestamp: time.Now(),
    })
```

**Testing:**
- Register multiple feeds
- Verify correct data sources used
- Test feed activation/deactivation

---

### Day 5-6: Persistent Rounds (Solidity)

**File:** `contracts/contracts/ObscuraOracle.sol`

**Changes:**
```solidity
// Add Round struct
struct Round {
    uint80 roundId;
    int256 answer;
    uint256 startedAt;
    uint256 updatedAt;
    uint80 answeredInRound;
}

// Add feed-specific round tracking
struct Feed {
    string id;
    uint80 latestRound;
    mapping(uint80 => Round) rounds;
    uint256 deviationThreshold;
    uint256 heartbeat;
    uint256 lastUpdate;
}

mapping(string => Feed) public feeds;
string[] public feedIds;

// Add feed registration
function registerFeed(
    string calldata feedId,
    uint256 deviationThreshold,
    uint256 heartbeat
) external onlyRole(ADMIN_ROLE) {
    require(bytes(feeds[feedId].id).length == 0, "Feed exists");
    feeds[feedId].id = feedId;
    feeds[feedId].deviationThreshold = deviationThreshold;
    feeds[feedId].heartbeat = heartbeat;
    feedIds.push(feedId);
}

// Update requestData to include feedId
function requestData(
    string calldata feedId,
    string calldata apiUrl,
    uint256 min,
    uint256 max,
    string calldata metadata
) external whenNotPaused nonReentrant returns (uint256) {
    require(bytes(feeds[feedId].id).length > 0, "Feed not registered");
    
    // ... existing payment logic ...
    
    uint256 requestId = nextRequestId++;
    Request storage req = requests[requestId];
    req.id = requestId;
    req.feedId = feedId;  // NEW
    req.apiUrl = apiUrl;
    // ... rest of existing code ...
}

// Update _aggregateAndFinalize to save round
function _aggregateAndFinalize(uint256 requestId) internal {
    Request storage req = requests[requestId];
    
    // ... existing aggregation logic ...
    
    // Save round
    Feed storage feed = feeds[req.feedId];
    uint80 roundId = ++feed.latestRound;
    
    Round storage round = feed.rounds[roundId];
    round.roundId = roundId;
    round.answer = int256(medianValue);
    round.startedAt = req.createdAt;
    round.updatedAt = block.timestamp;
    round.answeredInRound = roundId;
    
    feed.lastUpdate = block.timestamp;
    
    emit NewRound(req.feedId, roundId, req.createdAt);
    emit AnswerUpdated(req.feedId, roundId, int256(medianValue), block.timestamp);
    
    // ... existing reward/slash logic ...
}

// Add Chainlink-compatible view function
function latestRoundData(string calldata feedId) external view returns (
    uint80 roundId,
    int256 answer,
    uint256 startedAt,
    uint256 updatedAt,
    uint80 answeredInRound
) {
    Feed storage feed = feeds[feedId];
    require(feed.latestRound > 0, "No rounds");
    
    Round storage round = feed.rounds[feed.latestRound];
    return (
        round.roundId,
        round.answer,
        round.startedAt,
        round.updatedAt,
        round.answeredInRound
    );
}

// Add getRoundData for historical access
function getRoundData(string calldata feedId, uint80 _roundId) external view returns (
    uint80 roundId,
    int256 answer,
    uint256 startedAt,
    uint256 updatedAt,
    uint80 answeredInRound
) {
    Round storage round = feeds[feedId].rounds[_roundId];
    require(round.roundId > 0, "Round not found");
    
    return (
        round.roundId,
        round.answer,
        round.startedAt,
        round.updatedAt,
        round.answeredInRound
    );
}
```

**Testing:**
- Deploy updated contract
- Submit multiple rounds
- Verify `latestRoundData()` returns correct values
- Test historical `getRoundData()`

---

### Day 7: Comprehensive Integration Tests

**File:** `backend/integration_test.go` (new)

**Test Scenarios:**
1. End-to-end request flow
2. Multi-oracle aggregation
3. Outlier detection and slashing
4. ZK proof generation and verification
5. VRF request and fulfillment
6. Reorg handling
7. Job persistence and recovery
8. Multi-feed support

**File:** `contracts/test/Integration.test.js` (new)

**Test Scenarios:**
1. Full oracle lifecycle
2. Multiple feeds simultaneously
3. Deviation threshold triggers
4. Heartbeat updates
5. Slashing integration
6. Round history

---

## Phase 3: Production Polish (Days 8-14)

### Day 8-9: Deviation & Heartbeat Triggers

**File:** `backend/automation/triggers.go`

**Add:**
- Deviation monitoring per feed
- Heartbeat timers
- Automatic job dispatch

**File:** `contracts/contracts/ObscuraOracle.sol`

**Add:**
- On-chain deviation checks
- Heartbeat enforcement

---

### Day 10-11: EIP-1559 & Tx Recovery

**File:** `backend/node/tx_manager.go`

**Add:**
- EIP-1559 gas pricing
- Stuck transaction detection
- Automatic resubmission with higher gas

---

### Day 12: Consumer Access Control

**File:** `contracts/contracts/ObscuraOracle.sol`

**Add:**
- Consumer whitelist
- Request authorization
- Rate limiting

---

### Day 13-14: Documentation & Deployment

**Create:**
- Production deployment runbook
- Configuration guide
- Monitoring setup guide
- Troubleshooting guide

---

## Testing Checklist

### Unit Tests
- [ ] All backend packages have >80% coverage
- [ ] All contract functions tested
- [ ] Edge cases covered

### Integration Tests
- [ ] End-to-end oracle flow
- [ ] Multi-oracle aggregation
- [ ] Reorg scenarios
- [ ] Job recovery

### Load Tests
- [ ] 100 concurrent requests
- [ ] 1000 requests/hour sustained
- [ ] Memory leak detection

### Security Tests
- [ ] Slashing mechanism
- [ ] Access control
- [ ] Reentrancy protection
- [ ] Integer overflow/underflow

---

## Deployment Checklist

### Testnet (Sepolia)
- [ ] Deploy all contracts
- [ ] Register 3+ oracle nodes
- [ ] Configure 2+ feeds (ETH/USD, BTC/USD)
- [ ] Process 1000+ requests
- [ ] Run for 1 week
- [ ] Monitor metrics

### Mainnet Preparation
- [ ] External smart contract audit
- [ ] Bug bounty program
- [ ] Insurance coverage
- [ ] Multi-sig for admin functions
- [ ] Gradual rollout plan

---

## Success Metrics

### Performance
- Request latency < 30 seconds (p95)
- Proof generation < 5 seconds
- Transaction confirmation < 2 minutes
- Uptime > 99.9%

### Accuracy
- Outlier detection rate > 95%
- Slashing false positive rate < 1%
- Aggregation deviation < 0.1%

### Reliability
- Zero data loss on node restart
- Zero double-processing on reorg
- Successful recovery from all failure modes

---

## Risk Mitigation

### Technical Risks
- **ZK proof generation failure:** Fallback to non-ZK mode
- **Blockchain RPC failure:** Multiple RPC endpoints
- **Smart contract bug:** Pause functionality, insurance
- **Node crash:** Job persistence, automatic restart

### Operational Risks
- **Oracle collusion:** Reputation system, random selection
- **Data source failure:** Multiple sources, fallback APIs
- **Gas price spike:** Dynamic gas pricing, tx queue
- **Reorg attack:** Confirmation depth, checkpoint persistence

---

## Conclusion

This implementation plan provides a **clear path from 85% to 100% production-ready**. The work is **well-scoped and achievable** in 10-14 days with focused effort.

**Key Priorities:**
1. Days 1-2: Integration (reorg, persistence) - **Critical**
2. Days 3-4: Feed management - **Critical**
3. Days 5-6: Persistent rounds - **Critical**
4. Day 7: Testing - **Critical**
5. Days 8-14: Polish - **Important**

After completion, Obscura will be **Chainlink-grade** with **superior cryptographic capabilities**.
