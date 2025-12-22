# OBSCURA: Privacy-First Oracle Mesh 🌌

Obscura is a next-generation decentralized oracle network that prioritizes data privacy through hardware-grade zero-knowledge (ZK) orchestration. It allows smart contracts to consume high-fidelity data feeds without exposing underlying API keys, sensitivity, or private endpoint structures.

## 🚀 Key Features
- **ZK-Orchestration**: Prove data ranges (e.g., BTC > $65k) without revealing the exact price or source.
- **WASM Runtimes**: Secure, serverless execution of off-chain compute.
- **StakeGuard**: Cryptoeconomic security layer ensuring node reliability through $OBSCURA staking.
- **Anomaly Detection**: Integrated statistical filtering to eliminate malicious feed outliers.

---

## 🏗️ Project Structure
- **/frontend**: 3D Cyberpunk Dashboard built with React, Three.js, and Framer Motion.
- **/backend**: Core Go Node, ZK-Circuit Builder, and WASM Compute Runtime.
- **/contracts**: Solidity Smart Contracts (Hardhat) including on-chain ZK-Verifiers.
- **/docs**: Technical whitepapers and integration guides.

---

## 🛠️ Getting Started

### 1. Smart Contracts
Compile and test the on-chain infrastructure:
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### 2. Backend Node
Build and run the Go-based oracle node:
```bash
cd backend
go get ./...
go build -o obscura-node main.go
./obscura-node
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
- **Go SDK**: Located in `backend/sdk/client.go`
- **TypeScript SDK**: Located in `frontend/src/sdk/obscura.ts`

## 📄 License
MIT License - Obscura Network 2025.
"# obsucra" 
