# Obscura Network: Privacy-First Decentralized Oracle Mesh

**Obscura Network** is a decentralized oracle network (DON) that mirrors the reliability of industry standards like Chainlink while introducing native, hardware-agnostic privacy through **Zero-Knowledge Proofs (ZKPs)**.

## Project Structure

```text
obscura/
├── backend/        # Golang Core Node (Oracle Mesh & ZKP Logic)
├── contracts/      # Solidity Smart Contracts (Token, Oracle, Staking)
├── frontend/       # React + Three.js UI Dashboard
├── scripts/        # Deployment & Automation Scripts
├── docs/           # Architecture & Documentation
└── tests/          # Integration & Unit Tests
```

## Core Features

- **Obscura Mode**: Nodes reveal only the proof of data validity (range, threshold, or identity) without exposing sensitive API response bodies.
- **StakeGuard**: Multi-tier staking mechanism for node operators with cryptoeconomic security.
- **ComputeFuncs**: WASM-based off-chain computation delivered with ZK-verifiability.
- **CrossLink**: Privacy-preserving cross-chain messaging protocol.

## Technical Architecture

### Node Engine (Golang)
The core node is built in Go for high performance and concurrency. It utilizes:
- `go-ethereum`: For blockchain interaction and event monitoring.
- `gnark`: For generating ZK-SNARK proofs of data.
- `wasmtime-go`: Secure sandbox for executing custom ComputeFuncs.
- `gonum/security`: AI-based z-score anomaly detection for data integrity.
- `mux`: Providing a local REST API for node management.

### Smart Contracts (Solidity)
The network operates on Ethereum-compatible chains using:
- `ObscuraOracle.sol`: Manages data requests and node validation.
- `StakeGuard.sol`: Handles $OBSCURA token locking and reputation.
- `ObscuraToken.sol`: The native utility token for fees and rewards.

### Dashboard (React + Three.js)
A visually stunning experience featuring:
- **3D Global Mesh**: Real-time visualization of node health and data flows.
- **Neon-Infused Design**: Modern, premium aesthetics with glassmorphism and fluid animations.
- **Interactive Data Explorer**: Direct view into verified data streams.

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker

### Installation
1. Clone the repository and navigate to the directory.
2. **Backend**:
   ```bash
   cd backend
   go mod download
   go run main.go
   ```
3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Development Roadmap
- [ ] Phase 1: Core DON & Basic ZK Integration
- [ ] Phase 2: WASM Runtime Implementation
- [ ] Phase 3: Multi-Chain Bridge Beta
- [ ] Phase 4: Decentralized Governance (DAO)

---
*Built with ❤️ by the Obscura Team.*
