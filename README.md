# OBSCURA: Privacy-First Oracle Mesh 🌌

Obscura is a production-grade decentralized oracle network that prioritizes data privacy through hardware-grade zero-knowledge (ZK) orchestration and cryptoeconomic security. 

## 🚀 Key Features
- **ZK-Orchestration**: Prove data ranges (e.g., BTC > $65k) using Gnark Groth16 proofs without revealing the exact price or source.
- **Median Aggregation**: Distributed data collection where the final value is determined by on-chain median calculation across multiple nodes.
- **StakeGuard & Slashing**: Nodes must stake $OBSCURA to participate. Outliers that deviate >50% from the median are automatically slashed by 10 tokens.
- **Reward Distribution**: Fulfilling nodes share 90% of the request fee, incentivizing honest and timely data delivery.
- **Resilient Backend**: 
  - **Reactive Listener**: Real-time event monitoring with automatic RPC reconnection.
  - **Hardened Adapters**: HTTP fetching with exponential backoff retries.
  - **Atomic Persistence**: JSON storage with temp-file swap to prevent data corruption.

---

## 🏗️ Project Structure
- **/frontend**: 3D Cyberpunk Dashboard built with React, Three.js, and Framer Motion.
- **/backend**: Core Go Node, ZK-Circuit Builder (Gnark), and Job Orchestrator.
- **/contracts**: Solidity Smart Contracts (Hardhat) including `ObscuraOracle`, `StakeGuard`, and on-chain ZK-Verifiers.

---

## 🛠️ Getting Started

### 1. Smart Contracts
Compile and test the on-chain infrastructure:
```bash
cd contracts
npm install
powershell -ExecutionPolicy Bypass -Command "npx hardhat test"
```

### 2. Backend Node
Build and run the Go-based oracle node:
```bash
cd backend
go mod tidy
go build ./...
go run main.go
```

### 3. Frontend Dashboard
Launch the immersive visualization:
```bash
cd frontend
npm install
npm run dev
```

---

## 🔧 Multi-Platform SDKs
Obscura provides native SDKs for seamless integration:
- **Go SDK**: Responsive client for contract interaction.
- **TypeScript SDK**: Frontend hooks for data feed subscription.

## 📄 License
MIT License - Obscura Network 2025.
