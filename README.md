# OBSCURA ORACLE 🌌
## Enterprise-Grade Privacy-First Decentralized Oracle Network

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/obscura-network/obscura)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-orange.svg)](https://soliditylang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![Discord](https://img.shields.io/discord/123456789?label=Discord&logo=discord)](https://discord.gg/obscura)

---

**Obscura** is a production-grade decentralized oracle network that combines **zero-knowledge privacy** with enterprise-grade reliability. The first oracle to offer ZK range proofs, selective disclosure, and compliant data feeds for Real World Assets (RWA).

> *"Privacy is not a feature. It's a right."*

![Obscura Dashboard](docs/assets/dashboard-preview.png)

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Backend Node](#-backend-node)
- [Smart Contracts](#-smart-contracts)
- [Frontend Dashboard](#-frontend-dashboard)
- [TypeScript SDK](#-typescript-sdk)
- [API Reference](#-api-reference)
- [Monitoring & Observability](#-monitoring--observability)
- [Configuration](#-configuration)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Key Features

### 🔐 Zero-Knowledge Privacy Layer

Built with **Gnark** (BN254 curve) for production-grade ZK proofs:

| Circuit | Description |
|---------|-------------|
| **Range Proofs** | Prove "BTC > $65k" without revealing exact price |
| **TWAP Verification** | Time-weighted averages with hidden raw data points |
| **Proof of Reserves** | Cryptographic solvency attestations using Pedersen commitments |
| **Selective Disclosure** | Reveal data only to authorized auditors |
| **VRF Proofs** | Verifiable random function with deterministic outputs |
| **Bridge Proofs** | Cross-chain message relay verification |

### ⚡ Dual Oracle Architecture

- **Push Model**: WebSocket streaming with <500ms latency
- **Pull Model**: On-demand requests with 7-day Merkle proof caching
- **OCR Consensus**: Off-chain reporting with 90% gas savings
- **Optimistic Fulfillment**: Fast execution with 30-minute challenge window

### 🌐 Multi-Chain Support

| Network | Type | Status |
|---------|------|--------|
| Ethereum | L1 | ✅ Production |
| Arbitrum | L2 | ✅ Production |
| Base | L2 | ✅ Production |
| Optimism | L2 | ✅ Production |
| Polygon | L2 | ✅ Production |
| Avalanche | L1 | ✅ Production |
| BNB Chain | L1 | ✅ Production |
| zkSync | L2 | ✅ Production |
| Linea | L2 | ✅ Production |
| Scroll | L2 | ✅ Production |
| Mantle | L2 | ✅ Production |
| Solana | L1 | 🔄 In Progress |

### 🛡️ Enterprise Security

- **Staking & Slashing**: 10,000 OBSCURA minimum stake with automatic penalties
- **MAD Outlier Detection**: Median Absolute Deviation filtering
- **Circuit Breaker**: Auto-verification on >10% price swings
- **Reputation System**: Node scoring based on performance history
- **Multi-sig Admin**: Role-based access with time-locks
- **Reorg Protection**: 12-block confirmation depth

### 💰 OEV Recapture (Oracle Extractable Value)

Protocols can redirect MEV back to their treasury via OEV-positive requests:
- Searchers bid to fulfill requests first
- Bid proceeds flow to protocol's designated beneficiary
- Transparent auction mechanism

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OBSCURA NETWORK                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                    │
│  │   Frontend  │────▶│  Backend    │────▶│   Smart     │                    │
│  │  Dashboard  │     │   Node      │     │  Contracts  │                    │
│  │  (React)    │◀────│   (Go)      │◀────│  (Solidity) │                    │
│  └─────────────┘     └──────┬──────┘     └─────────────┘                    │
│         │                   │                   │                           │
│         │           ┌───────┴───────┐           │                           │
│         │           │               │           │                           │
│  ┌──────┴──────┐    │  ┌─────────┐  │    ┌──────┴──────┐                    │
│  │  TypeScript │    │  │   ZKP   │  │    │  External   │                    │
│  │     SDK     │    │  │ Circuits│  │    │   Data      │                    │
│  └─────────────┘    │  └─────────┘  │    │  Sources    │                    │
│                     │               │    └─────────────┘                    │
│              ┌──────┴───────┐       │                                       │
│              │              │       │                                       │
│         ┌────┴────┐   ┌─────┴────┐  │                                       │
│         │   OCR   │   │   VRF    │  │                                       │
│         │Consensus│   │ Manager  │  │                                       │
│         └─────────┘   └──────────┘  │                                       │
│                                     │                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
obscura/
├── backend/                    # Go Oracle Node (Production)
│   ├── adapters/               # External data source adapters
│   ├── ai/                     # Predictive analytics & forecasting
│   │   └── predictive.go       # Linear regression model (gonum/stat)
│   ├── api/                    # REST API & metrics endpoints
│   │   ├── router.go           # HTTP router setup
│   │   └── metrics.go          # Prometheus metrics collector
│   ├── automation/             # Keeper/Trigger system
│   │   └── triggers.go         # Conditional job execution
│   ├── chains/                 # Multi-chain adapters
│   ├── cmd/                    # CLI entry points
│   ├── compute/                # Confidential compute (WASM)
│   ├── consensus/              # Off-Chain Reporting (OCR)
│   │   └── ocr.go              # OCR manager with VRF leader election
│   ├── crosschain/             # Cross-chain messaging
│   │   └── crosslink.go        # ZK-verified bridge proofs
│   ├── functions/              # Compute manager
│   ├── node/                   # Node orchestration
│   │   ├── node.go             # Main node coordinator
│   │   ├── jobs.go             # Job manager (13+ job types)
│   │   ├── listener.go         # Blockchain event listener
│   │   ├── reorg_protection.go # Chain reorganization handling
│   │   ├── stake_sync.go       # Staking synchronization
│   │   ├── tx_manager.go       # EIP-1559 transaction management
│   │   └── gas_pricer.go       # Dynamic gas pricing
│   ├── oracle/                 # Core oracle logic
│   │   ├── feeds.go            # Feed management
│   │   ├── push/               # WebSocket streaming
│   │   └── pull/               # Merkle cache & proofs
│   ├── sdk/                    # Internal SDK
│   ├── security/               # Security components
│   │   ├── access_control.go   # Role-based permissions
│   │   ├── anomaly_detection.go # MAD outlier detection
│   │   └── reputation.go       # Node reputation scoring
│   ├── staking/                # Staking logic
│   ├── storage/                # Persistent storage
│   │   ├── store.go            # Storage interface
│   │   ├── badger_store.go     # BadgerDB implementation
│   │   └── secrets.go          # Secret management
│   ├── vrf/                    # Verifiable Random Function
│   │   └── vrf.go              # RFC 6979 deterministic signatures
│   └── zkp/                    # Zero-Knowledge Proofs
│       ├── zkp.go              # Range, VRF, Bridge circuits
│       └── advanced_circuits.go # TWAP, PoR, Selective Disclosure
│
├── contracts/                  # Solidity Smart Contracts
│   ├── contracts/
│   │   ├── ObscuraOracle.sol   # Core oracle + VRF + OEV
│   │   ├── StakeGuard.sol      # Staking & slashing
│   │   ├── NodeRegistry.sol    # Decentralized node management
│   │   ├── ObscuraToken.sol    # OBSCURA ERC-20 token
│   │   ├── ObscuraGovernance.sol # DAO governance
│   │   ├── KeeperNetwork.sol   # Automation triggers
│   │   ├── ProofOfReserve.sol  # Reserve attestations
│   │   └── Verifier.sol        # Gnark-exported ZK verifier
│   ├── integrations/
│   │   └── AaveV3Adapter.sol   # Aave V3 price oracle adapter
│   ├── scripts/                # Deployment scripts
│   └── test/                   # Contract tests
│
├── frontend/                   # React + TypeScript Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── LandingPage.tsx     # Marketing landing page
│   │   │   ├── NetworkDashboard.tsx # Real-time network stats
│   │   │   ├── DataFeeds.tsx       # Live price feeds
│   │   │   ├── FeedsExplorer.tsx   # Feed discovery
│   │   │   ├── StakingInterface.tsx # Staking UI
│   │   │   ├── Governance.tsx      # DAO voting interface
│   │   │   ├── Developers.tsx      # API documentation
│   │   │   ├── EnterpriseGateway.tsx # Enterprise features
│   │   │   ├── ConfidentialCompute.tsx # ZK compute interface
│   │   │   └── ...                 # Additional components
│   │   ├── sdk/                    # Frontend SDK integration
│   │   └── App.tsx                 # Main application
│   └── package.json
│
├── sdk/
│   └── typescript/             # TypeScript SDK
│       ├── src/
│       │   ├── client.ts       # Main ObscuraClient
│       │   ├── hooks.ts        # React hooks (usePrice, usePriceStream, useVRF)
│       │   ├── feeds.ts        # Feed utilities
│       │   ├── vrf.ts          # VRF helpers
│       │   ├── types.ts        # TypeScript definitions
│       │   └── utils.ts        # Utility functions
│       └── package.json
│
├── monitoring/                 # Observability stack
│   ├── prometheus.yml          # Prometheus config
│   ├── alertmanager.yml        # Alert rules
│   └── grafana/                # Grafana dashboards
│
├── Documentations/             # Comprehensive documentation
│   ├── ENTERPRISE_UPGRADE_ROADMAP.md
│   ├── COMPETITIVE_ANALYSIS.md
│   ├── NODE_OPERATOR_MANUAL.md
│   ├── INVESTOR_ONE_PAGER.md
│   ├── TESTNET_DEPLOYMENT_GUIDE.md
│   └── ...
│
├── docker-compose.yml          # Production deployment
├── Makefile                    # Build automation
└── .env.example                # Environment template
```

---

## 🛠️ Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Go | 1.21+ |
| Node.js | 18+ |
| Docker | 20.10+ |
| Docker Compose | 2.0+ |

### 1. Clone & Setup

```bash
git clone https://github.com/obscura-network/obscura.git
cd obscura

# Copy and configure environment
cp .env.example .env
# Edit .env with your RPC URLs and private keys
```

### 2. Build Everything

```bash
make build
```

Or individually:

```bash
# Backend
cd backend && go build -o obscura-node ./cmd/node

# Contracts
cd contracts && npm install && npx hardhat compile

# Frontend
cd frontend && npm install && npm run build

# SDK
cd sdk/typescript && npm install && npm run build
```

### 3. Run Development Stack

```bash
# Start all services
docker-compose up -d

# Or run individually:
cd backend && ./obscura-node
cd frontend && npm run dev
```

---

## 🖥️ Backend Node

The Go backend is the core of the Obscura network, handling:

### Core Components

| Component | Description |
|-----------|-------------|
| **JobManager** | Processes 13+ job types (DataFeed, VRF, Automation, ZKProof, etc.) |
| **EventListener** | Monitors on-chain events for job triggers |
| **OCR Manager** | Off-chain reporting with VRF-based leader election |
| **VRF Manager** | RFC 6979 deterministic signatures for verifiable randomness |
| **TxManager** | EIP-1559 gas estimation and transaction management |
| **FeedManager** | Live price feed aggregation and caching |
| **MetricsCollector** | Prometheus-compatible metrics export |

### Supported Job Types

```go
const (
    JobTypeDataFeed          // Price feed fulfillment
    JobTypeVRF               // Verifiable randomness
    JobTypeAutomation        // Conditional triggers
    JobTypeZKProof           // Zero-knowledge proof generation
    JobTypeCrossChain        // Cross-chain messaging
    JobTypeFunctions         // Confidential compute
    JobTypePrediction        // AI-powered forecasting
    JobTypeSecretsRequest    // Secret management
    JobTypeProofOfReserves   // Reserve attestations
    JobTypeTWAP              // Time-weighted average price
    JobTypeSelectiveDisc     // Selective disclosure
    JobTypeKeeper            // Keeper network tasks
    JobTypeOEV               // OEV recapture
)
```

### Running the Node

```bash
cd backend

# Development
go run ./cmd/node

# Production
go build -o obscura-node ./cmd/node
./obscura-node
```

### Configuration

The node uses Viper for configuration (environment variables or `config.yaml`):

```yaml
# config.yaml
port: "8080"
log_level: "info"
telemetry_mode: true
db_path: "./data/node.db.json"
ethereum_url: "wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
oracle_contract_address: "0x..."
stake_guard_address: "0x..."
private_key: "YOUR_PRIVATE_KEY"
```

---

## 📜 Smart Contracts

### Contract Architecture

| Contract | Description |
|----------|-------------|
| **ObscuraOracle.sol** | Core oracle with VRF, OEV, optimistic fulfillment |
| **StakeGuard.sol** | 100 OBSCURA minimum stake, 7-day unbonding |
| **NodeRegistry.sol** | Node registration, reputation, consensus |
| **ObscuraToken.sol** | ERC-20 with governance capabilities |
| **ObscuraGovernance.sol** | DAO proposal and voting system |
| **KeeperNetwork.sol** | Automation trigger registry |
| **ProofOfReserve.sol** | Reserve attestation commitments |
| **Verifier.sol** | Gnark-exported Groth16 verifier |

### Chainlink-Compatible Interface

```solidity
// Drop-in replacement for Chainlink AggregatorV3Interface
interface IObscuraOracle {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    function decimals() external pure returns (uint8);
    function description() external pure returns (string memory);
    function version() external pure returns (uint256);
}
```

### Deployment

```bash
cd contracts

# Install dependencies
npm install

# Compile
npx hardhat compile

# Deploy to testnet
npx hardhat run scripts/deploy.js --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia DEPLOYED_ADDRESS
```

### Integration Example

```solidity
import "@obscura/contracts/interfaces/IObscuraOracle.sol";

contract MyProtocol {
    IObscuraOracle public oracle;
    
    constructor(address _oracle) {
        oracle = IObscuraOracle(_oracle);
    }
    
    function getETHPrice() public view returns (int256) {
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = oracle.latestRoundData();
        
        require(answer > 0, "Invalid price");
        require(block.timestamp - updatedAt < 3600, "Stale price");
        
        return answer;
    }
}
```

---

## 🎨 Frontend Dashboard

The React frontend provides a comprehensive interface for:

- **Real-time Network Stats**: Active nodes, ZK proofs/sec, request latency
- **Live Price Feeds**: With confidence intervals and ZK verification badges
- **Staking Interface**: Stake/unstake with reputation tracking
- **Governance Portal**: Create and vote on proposals
- **Developer Docs**: API reference and integration guides
- **Enterprise Gateway**: Credential management and custom feeds

### Running Locally

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Building for Production

```bash
npm run build
# Output in dist/
```

---

## 📦 TypeScript SDK

### Installation

```bash
npm install @obscura/sdk
# or
yarn add @obscura/sdk
```

### Basic Usage

```typescript
import { ObscuraClient } from '@obscura/sdk';

const client = new ObscuraClient({ 
  chain: 'base', 
  apiKey: 'your-api-key' 
});

// Pull model - get price with ZK proof
const priceData = await client.getPrice('ETH/USD', { 
  proof: true,
  maxAge: 60 
});
console.log(`ETH/USD: ${priceData.value}`);

// Push model - subscribe to real-time updates
const unsubscribe = client.subscribe('ETH/USD', (update) => {
  console.log(`New price: ${update.value}`);
});

// VRF - request verifiable randomness
const vrf = await client.requestRandomness({ seed: 'my-seed' });
console.log(`Random: ${vrf.randomWords[0]}`);

// Cleanup
client.destroy();
```

### React Hooks

```tsx
import { usePrice, usePriceStream, useVRF } from '@obscura/sdk';

function PriceDisplay() {
  // Single price fetch
  const { data, loading, error } = usePrice('ETH/USD');
  
  // Real-time streaming
  const { price, isConnected } = usePriceStream('ETH/USD');
  
  // VRF
  const { requestRandomness, result } = useVRF();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <p>ETH/USD: ${data?.value}</p>
      <p>Live: ${price?.value}</p>
      {result && <p>Random: {result.randomWords[0]}</p>}
    </div>
  );
}
```

### Supported Chains

```typescript
type SupportedChain = 
  | 'ethereum' 
  | 'arbitrum' 
  | 'base' 
  | 'optimism' 
  | 'polygon'
  | 'avalanche'
  | 'bnb'
  | 'zksync'
  | 'linea'
  | 'scroll'
  | 'mantle';
```

---

## 📡 API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/stats` | GET | Network statistics |
| `/metrics/prometheus` | GET | Prometheus metrics |
| `/metrics/dashboard` | GET | Dashboard metrics |
| `/metrics/live-feeds` | GET | Real-time feed data |
| `/metrics/job-history` | GET | Job execution history |
| `/v1/prices/{feedId}` | GET | Get price with optional proof |
| `/v1/prices/batch` | GET | Batch price retrieval |
| `/v1/feeds` | GET | List all available feeds |
| `/v1/vrf/request` | POST | Request verifiable randomness |

### WebSocket

```javascript
const ws = new WebSocket('wss://ws.obscura.network/v1/base');

ws.send(JSON.stringify({
  action: 'subscribe',
  feed_ids: ['ETH/USD', 'BTC/USD']
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`${data.feed_id}: ${data.value}`);
};
```

---

## 📊 Monitoring & Observability

### Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `obscura_requests_total` | Counter | Total requests processed |
| `obscura_request_latency_ms` | Histogram | Request latency distribution |
| `obscura_proofs_generated` | Counter | ZK proofs generated |
| `obscura_oev_recaptured` | Counter | OEV recaptured (wei) |
| `obscura_errors_total` | Counter | Error count by type |
| `obscura_active_nodes` | Gauge | Active node count |

### Grafana Dashboards

Pre-configured dashboards for:
- Network health and performance
- Price feed accuracy
- Node reputation trends
- ZK proof generation metrics
- OEV recapture analytics

### Alerting

```yaml
# monitoring/alertmanager.yml
route:
  receiver: 'slack-notifications'
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/...'
        channel: '#obscura-alerts'
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# ============ RPC ENDPOINTS ============
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHEREUM_WS_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-sepolia.g.alchemy.com/v2/YOUR_KEY

# ============ CONTRACT ADDRESSES ============
ORACLE_ADDRESS=0x...
STAKE_GUARD_ADDRESS=0x...
TOKEN_ADDRESS=0x...
NODE_REGISTRY_ADDRESS=0x...

# ============ NODE CONFIG ============
NODE_PRIVATE_KEY=your_private_key_without_0x
NODE_PORT=8080
LOG_LEVEL=info
OBSCURA_TELEMETRY_MODE=true

# ============ SECURITY ============
ANOMALY_THRESHOLD=2.5
CIRCUIT_BREAKER_THRESHOLD=10

# ============ MONITORING ============
GRAFANA_PASSWORD=secure_password
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# ============ FRONTEND ============
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
go test ./...

# With coverage
go test -cover ./...

# Specific package
go test ./zkp/...
go test ./vrf/...
```

### Contract Tests

```bash
cd contracts

# Run all tests
npx hardhat test

# With gas reporting
REPORT_GAS=true npx hardhat test

# Specific test file
npx hardhat test test/ObscuraOracle.test.js
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Integration Tests

```bash
cd backend
go test ./node/integration_test.go -v
```

---

## 🚀 Deployment

### Docker Compose (Recommended)

```bash
# Development
docker-compose up -d

# Production with NGINX & Redis
docker-compose --profile production up -d
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| obscura-node | 8080 | Backend API |
| obscura-push | 8081 | WebSocket server |
| obscura-frontend | 3000 | Dashboard UI |
| prometheus | 9091 | Metrics |
| grafana | 3001 | Dashboards |
| alertmanager | 9093 | Alerts |
| loki | 3100 | Log aggregation |

### Kubernetes

Helm charts available in `deploy/helm/` (coming soon).

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Enterprise Upgrade Roadmap](Documentations/ENTERPRISE_UPGRADE_ROADMAP.md) | Strategic implementation plan |
| [Competitive Analysis](Documentations/COMPETITIVE_ANALYSIS.md) | vs. Chainlink, Pyth, RedStone, API3 |
| [Node Operator Manual](Documentations/NODE_OPERATOR_MANUAL.md) | Setup and operations guide |
| [Testnet Deployment Guide](Documentations/TESTNET_DEPLOYMENT_GUIDE.md) | Step-by-step testnet setup |
| [Investor One-Pager](Documentations/INVESTOR_ONE_PAGER.md) | Series A summary |
| [Implementation Summary](Documentations/IMPLEMENTATION_SUMMARY.md) | Technical status |
| [Final Audit Summary](Documentations/FINAL_AUDIT_SUMMARY.md) | Code audit results |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Go**: Follow standard Go formatting (`go fmt`)
- **TypeScript**: ESLint + Prettier
- **Solidity**: Solhint + Prettier

---

## 🔗 Links

- **Website**: [obscura.network](https://obscura.network)
- **Documentation**: [docs.obscura.network](https://docs.obscura.network)
- **Discord**: [discord.gg/obscura](https://discord.gg/obscura)
- **Twitter**: [@ObscuraOracle](https://twitter.com/ObscuraOracle)
- **GitHub**: [github.com/obscura-network/obscura](https://github.com/obscura-network/obscura)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🏆 Acknowledgments

- [Gnark](https://github.com/ConsenSys/gnark) - ZK proof library
- [go-ethereum](https://github.com/ethereum/go-ethereum) - Ethereum client
- [OpenZeppelin](https://openzeppelin.com/) - Smart contract security
- [Gorilla Mux](https://github.com/gorilla/mux) - HTTP router
- [Viper](https://github.com/spf13/viper) - Configuration management
- [Zerolog](https://github.com/rs/zerolog) - Structured logging
- [gonum](https://github.com/gonum/gonum) - Scientific computing

---

<div align="center">

**Built with ❤️ by the Obscura Network team**

*Privacy is not a feature. It's a right.*

</div>
