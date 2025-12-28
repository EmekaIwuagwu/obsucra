# Obscura Node Operator Manual

## Overview

This guide covers everything you need to know to operate an Obscura Oracle node. Node operators are critical to the network's security and earn rewards for providing accurate, timely data.

---

## Hardware Requirements

### Minimum Specifications
| Component | Requirement |
|-----------|-------------|
| CPU | 4 cores, 2.5 GHz |
| RAM | 16 GB |
| Storage | 500 GB SSD |
| Network | 100 Mbps, static IP |
| Uptime | 99.5% target |

### Recommended Specifications
| Component | Requirement |
|-----------|-------------|
| CPU | 8 cores, 3.0 GHz |
| RAM | 32 GB |
| Storage | 1 TB NVMe SSD |
| Network | 1 Gbps, redundant |
| Uptime | 99.9% target |

### Geographic Distribution
- Operators should be distributed across regions
- Maximum 5 nodes per data center
- Latency to major chains < 100ms preferred

---

## Staking Requirements

### Minimum Stake
- **10,000 OBSCURA tokens** required to participate
- Stake must remain locked during operation
- 14-day unbonding period when withdrawing

### Slashing Conditions
| Condition | Penalty |
|-----------|---------|
| Downtime > 5% (30-day rolling) | 2% stake |
| Invalid data submission | 5% stake |
| Data deviation > 50% from median | 10 tokens per incident |
| Malicious behavior | 100% stake |

### Rewards
- **Base rate**: 5% APR on stake
- **Performance bonus**: Up to 3% additional for top performers
- **Tip market**: Extra rewards for priority requests

---

## Installation

### Prerequisites
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
docker --version

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Go (for building from source)
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/bin/go
```

### Docker Installation (Recommended)
```bash
# Clone the repository
git clone https://github.com/obscura-network/obscura.git
cd obscura/backend

# Configure environment
cp .env.example .env
nano .env

# Start the node
docker-compose up -d
```

### Manual Installation
```bash
cd obscura/backend
go mod tidy
go build -o obscura-node ./cmd/obscura

# Create config file
cat > config.yaml << EOF
port: "8080"
log_level: "info"
telemetry_mode: true
db_path: "./data/node.db.json"
ethereum_url: "wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
oracle_contract_address: "0x..."
stake_guard_address: "0x..."
private_key: "YOUR_PRIVATE_KEY"
EOF

# Start the node
./obscura-node
```

---

## Configuration

### Environment Variables

```bash
# Required
OBSCURA_PRIVATE_KEY=your_node_private_key
OBSCURA_RPC_URL=wss://eth-mainnet.g.alchemy.com/v2/xxx
OBSCURA_ORACLE_CONTRACT=0x...
OBSCURA_STAKE_GUARD=0x...

# Optional
OBSCURA_PORT=8080
OBSCURA_LOG_LEVEL=info
OBSCURA_DB_PATH=./data/node.db.json
OBSCURA_TELEMETRY_MODE=true
OBSCURA_METRICS_PORT=9090

# Multi-chain (optional)
OBSCURA_ARBITRUM_RPC=wss://arb-mainnet.g.alchemy.com/v2/xxx
OBSCURA_BASE_RPC=wss://base-mainnet.g.alchemy.com/v2/xxx
OBSCURA_OPTIMISM_RPC=wss://opt-mainnet.g.alchemy.com/v2/xxx
```

### config.yaml

```yaml
# Core settings
port: "8080"
log_level: "info"  # debug, info, warn, error
telemetry_mode: true

# Storage
db_path: "./data/node.db.json"

# Primary chain
ethereum_url: "wss://eth-mainnet.g.alchemy.com/v2/xxx"
oracle_contract_address: "0x..."
stake_guard_address: "0x..."
private_key: "${OBSCURA_PRIVATE_KEY}"

# Multi-chain configuration
chains:
  arbitrum:
    enabled: true
    rpc_url: "wss://arb-mainnet.g.alchemy.com/v2/xxx"
    oracle_contract: "0x..."
    confirmations: 1
  base:
    enabled: true
    rpc_url: "wss://base-mainnet.g.alchemy.com/v2/xxx"
    oracle_contract: "0x..."
    confirmations: 1

# Performance tuning
job_concurrency: 10
max_retries: 3
retry_delay_ms: 1000

# Security
allowed_origins:
  - "https://api.obscura.network"
```

---

## Operations

### Starting the Node
```bash
# With Docker
docker-compose up -d

# Check logs
docker-compose logs -f obscura-node

# From source
./obscura-node --config config.yaml
```

### Stopping the Node
```bash
# Graceful shutdown
docker-compose down

# Or kill the process
kill -SIGTERM $(pidof obscura-node)
```

### Updating the Node
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

### Health Checks
```bash
# Check node health
curl http://localhost:8080/health

# Check metrics
curl http://localhost:8080/metrics/prometheus

# Check job queue
curl http://localhost:8080/api/jobs/pending
```

---

## Monitoring

### Prometheus Metrics

Enable Prometheus scraping:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'obscura-node'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics/prometheus'
```

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `obscura_requests_total` | Total requests processed | N/A |
| `obscura_request_latency_ms` | Request latency | > 5000ms |
| `obscura_proofs_generated` | ZK proofs generated | N/A |
| `obscura_errors_total` | Error count | > 10/min |
| `obscura_stake_balance` | Current stake | < 10000 |
| `obscura_uptime_percent` | Node uptime | < 99.5% |

### Grafana Dashboard

Import the dashboard from `monitoring/grafana-dashboard.json`:

```bash
# Deploy Grafana stack
cd monitoring
docker-compose up -d
```

Access at: `http://localhost:3000` (admin/admin)

### Alerting

Configure alerts in `monitoring/alertmanager.yml`:

```yaml
groups:
  - name: obscura-alerts
    rules:
      - alert: NodeDown
        expr: up{job="obscura-node"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Obscura node is down"
          
      - alert: HighLatency
        expr: obscura_request_latency_ms > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High request latency detected"
          
      - alert: LowStake
        expr: obscura_stake_balance < 10000
        labels:
          severity: critical
        annotations:
          summary: "Stake below minimum requirement"
```

---

## Troubleshooting

### Common Issues

#### Node not syncing
```bash
# Check RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $OBSCURA_RPC_URL

# Check contract address
cast call $OBSCURA_ORACLE_CONTRACT "version()" --rpc-url $OBSCURA_RPC_URL
```

#### High memory usage
```bash
# Check Go memory stats
curl http://localhost:8080/debug/pprof/heap > heap.prof
go tool pprof heap.prof

# Increase memory limit in docker-compose
deploy:
  resources:
    limits:
      memory: 8G
```

#### Transaction failures
```bash
# Check gas prices
curl http://localhost:8080/api/gas/estimate

# Check node balance
cast balance $NODE_ADDRESS --rpc-url $OBSCURA_RPC_URL
```

### Log Analysis
```bash
# View recent errors
docker-compose logs --since 1h | grep -i error

# View specific request
docker-compose logs | grep "requestId=12345"

# Export logs
docker-compose logs > node_logs_$(date +%Y%m%d).txt
```

---

## Security Best Practices

### Key Management
1. Never store private keys in plain text
2. Use environment variables or secure vaults
3. Consider HSM for production keys
4. Rotate keys annually

### Network Security
1. Use firewall to restrict access
2. Only expose port 8080 if needed
3. Use VPN for admin access
4. Enable DDoS protection

### Updates
1. Subscribe to security announcements
2. Apply patches within 24 hours
3. Test updates on staging first
4. Keep dependencies updated

```bash
# Security audit
go mod verify
go list -m -u all
```

---

## Support

- **Discord**: discord.gg/obscura
- **Telegram**: t.me/obscura_nodes
- **Email**: nodes@obscura.network
- **Documentation**: docs.obscura.network

### Reporting Issues
1. Check existing issues on GitHub
2. Include node version and logs
3. Describe expected vs actual behavior
4. Provide reproduction steps

---

*Version: 1.0.0 | Last Updated: 2025-12-28*
