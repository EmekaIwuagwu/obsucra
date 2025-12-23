# Obscura E2E Handshake Guide 🤝

This document outlines how to run the full End-to-End integration test of the Obscura Privacy Oracle.

## Prerequisites
- Node.js & NPM
- Go (1.21+)
- Hardhat (`npx hardhat`)

## Step 1: Start Local Blockchain
In a dedicated terminal, start the local Hardhat node:
```bash
cd contracts
npx hardhat node
```

## Step 2: Deploy & Configure Stack
In a new terminal, run the E2E setup script. This will deploy the Token, StakeGuard, Verifier, and Oracle, and automatically generate the backend configuration.
```bash
cd contracts
npx hardhat run scripts/e2e_integration.js --network localhost
```
**Take note of the Oracle Address** printed in the output.

## Step 3: Run the Obscura Node
The previous step generated `backend/config.yaml`. Now, start the node:
```bash
cd backend
go run main.go
```
The node will connect to the local blockchain and start listening for events.

## Step 4: Run the Frontend (Optional)
If you want to see the numbers move in the dashboard:
```bash
cd frontend
npm run dev
```

## Step 5: Trigger a Request
In a separate terminal, trigger a live data feed request. Replace `0x...` with the Oracle address from Step 2:
```bash
cd contracts
$env:ORACLE_ADDR="0xYourOracleAddress"
npx hardhat run scripts/trigger_request.js --network localhost
```

## What to Watch For:
1. **Node Terminal**: You will see the node detect the `RequestData` event, fetch the price of BTC, generate a ZK Range Proof, and submit a `fulfillData` transaction.
2. **Trigger Script**: The script will detect the `RequestFulfilled` event and print the final aggregated value and the New Round ID.
3. **Frontend**: The "Live Telemetry" panel in the dashboard will increment the "Requests Processed" and "ZK Proofs Generated" counters.

---
**Obscura Network: Privacy-First Oracle Infrastructure**
