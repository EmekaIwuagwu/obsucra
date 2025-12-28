# Obscura Oracle - Testnet Deployment & Demo Guide

## Quick Start: Get Testnet Tokens

To test the Obscura Oracle, you'll need testnet tokens on supported chains. Here are the faucet links:

### 🔗 Ethereum Sepolia
| Faucet | Link | Daily Limit |
|--------|------|-------------|
| **Alchemy Sepolia** (Recommended) | https://sepoliafaucet.com | 0.5 ETH |
| **Infura Sepolia** | https://www.infura.io/faucet/sepolia | 0.5 ETH |
| **Google Cloud Sepolia** | https://cloud.google.com/application/web3/faucet/ethereum/sepolia | 0.05 ETH |
| **QuickNode Sepolia** | https://faucet.quicknode.com/ethereum/sepolia | 0.1 ETH |
| **Chainlink Faucets** | https://faucets.chain.link/sepolia | 0.1 ETH + LINK |

### 🔵 Base Sepolia (L2)
| Faucet | Link | Notes |
|--------|------|-------|
| **Coinbase Base Faucet** | https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet | Requires Coinbase account |
| **Alchemy Base Sepolia** | https://basefaucet.com | 0.05 ETH daily |
| **Bridge from Sepolia** | https://bridge.base.org/deposit | Bridge Sepolia ETH to Base |

### 🔴 Arbitrum Sepolia (L2)
| Faucet | Link | Notes |
|--------|------|-------|
| **Alchemy Arbitrum** | https://www.alchemy.com/faucets/arbitrum-sepolia | 0.1 ETH |
| **Chainlink Arbitrum** | https://faucets.chain.link/arbitrum-sepolia | 0.1 ETH + LINK |
| **QuickNode Arbitrum** | https://faucet.quicknode.com/arbitrum/sepolia | 0.1 ETH |
| **Bridge from Sepolia** | https://bridge.arbitrum.io | Bridge from L1 Sepolia |

### 🟣 Optimism Sepolia (L2)
| Faucet | Link | Notes |
|--------|------|-------|
| **Alchemy Optimism** | https://www.alchemy.com/faucets/optimism-sepolia | 0.1 ETH |
| **Superchain Faucet** | https://app.optimism.io/faucet | Requires GitHub auth |
| **QuickNode Optimism** | https://faucet.quicknode.com/optimism/sepolia | 0.1 ETH |

### 🟢 Solana Devnet
| Faucet | Link | Notes |
|--------|------|-------|
| **Solana CLI** | `solana airdrop 2` | 2 SOL per request |
| **SolFaucet** | https://solfaucet.com | Web-based faucet |
| **QuickNode Solana** | https://faucet.quicknode.com/solana/devnet | 1 SOL |

---

## 📋 Deployment Checklist

### Step 1: Get API Keys
1. **Alchemy** (Recommended): https://dashboard.alchemy.com
   - Create apps for: Sepolia, Base Sepolia, Arbitrum Sepolia
2. **Infura** (Alternative): https://app.infura.io

### Step 2: Fund Deployer Wallet
1. Generate a new wallet: `cast wallet new`
2. Save the private key securely
3. Get testnet ETH from faucets above
4. **Recommended**: Start with Sepolia, then bridge to L2s

### Step 3: Configure Environment
```bash
# Copy example env
cp .env.example .env

# Edit with your values
nano .env
```

**.env Configuration:**
```bash
# RPC URLs (get from Alchemy/Infura)
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-sepolia.g.alchemy.com/v2/YOUR_KEY

# Deployer wallet
PRIVATE_KEY=your_private_key_here

# Optional: Etherscan API keys for verification
ETHERSCAN_API_KEY=your_etherscan_key
BASESCAN_API_KEY=your_basescan_key
ARBISCAN_API_KEY=your_arbiscan_key
```

### Step 4: Deploy Contracts
```bash
cd contracts

# Deploy to Sepolia first
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to L2s
npx hardhat run scripts/deploy.js --network baseSepolia
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

### Step 5: Start Backend
```bash
cd backend
go build -o obscura-node ./cmd/obscura
./obscura-node
```

### Step 6: Start Frontend
```bash
cd frontend
npm run dev
```

---

## 🌊 Digital Ocean Deployment

### Option A: One-Click Docker Deployment

```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Clone repository
git clone https://github.com/obscura-network/obscura.git
cd obscura

# Configure environment
cp .env.example .env
nano .env  # Add your API keys

# Start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Option B: Manual Deployment Script

Save this as `deploy-digitalocean.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Obscura Oracle to Digital Ocean..."

# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Go (for building from source)
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Clone Obscura
git clone https://github.com/obscura-network/obscura.git /opt/obscura
cd /opt/obscura

# Build backend
cd backend
go build -o obscura-node ./cmd/obscura

# Build frontend
cd ../frontend
npm install
npm run build

# Create systemd service for backend
cat > /etc/systemd/system/obscura-backend.service << 'EOF'
[Unit]
Description=Obscura Oracle Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/obscura/backend
ExecStart=/opt/obscura/backend/obscura-node
Restart=always
RestartSec=5
Environment=OBSCURA_PORT=8080

[Install]
WantedBy=multi-user.target
EOF

# Enable and start backend
systemctl daemon-reload
systemctl enable obscura-backend
systemctl start obscura-backend

# Install nginx for frontend
apt-get install -y nginx

# Configure nginx
cat > /etc/nginx/sites-available/obscura << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/obscura/frontend/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
EOF

ln -sf /etc/nginx/sites-available/obscura /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Setup firewall
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable

echo "✅ Deployment complete!"
echo "🌐 Access your dashboard at: http://$(curl -s ifconfig.me)"
echo "📊 API endpoint: http://$(curl -s ifconfig.me)/api"
```

### Deploy:
```bash
chmod +x deploy-digitalocean.sh
./deploy-digitalocean.sh
```

---

## 🎬 Creating Demo GIFs for Grant Applications

### Option 1: ScreenToGif (Windows)
1. Download: https://www.screentogif.com/
2. Record your browser showing the dashboard
3. Export as GIF or WebP

### Option 2: LICEcap (Cross-platform)
1. Download: https://www.cockos.com/licecap/
2. Simple, lightweight GIF recorder

### Option 3: Using Claude (Browser Recording)

I can create recordings for you! Just ask me to:
- "Record a demo of the dashboard"
- "Create a GIF showing the feeds explorer"

### Recommended Demo Scenes:

1. **Dashboard Overview** (10-15 seconds)
   - Show the Network Dashboard loading
   - Highlight live telemetry updating
   - Show chain statistics

2. **Price Feeds Demo** (15-20 seconds)
   - Navigate to Feeds Explorer
   - Show ZK-verified prices updating
   - Toggle Obscura mode on/off

3. **VRF Randomness** (10 seconds)
   - Request random value
   - Show proof generation

4. **Multi-Chain Support** (10 seconds)
   - Show Ethereum, Arbitrum, Base, Solana status

---

## 📝 Grant Application Materials

### Grant Programs to Apply For:

| Program | Link | Focus | Amount |
|---------|------|-------|--------|
| **Arbitrum LTIPP** | https://arbitrum.foundation/grants | Oracle infrastructure | $50k-500k |
| **Base Ecosystem Fund** | https://base.org/grants | L2 oracles | $25k-250k |
| **Optimism RetroPGF** | https://optimism.io/grants | Public goods | Variable |
| **Solana Foundation** | https://solana.org/grants | Solana oracles | $25k-250k |
| **Ethereum Foundation** | https://esp.ethereum.foundation | ZK research | $50k-200k |
| **Chainlink BUILD** | https://chain.link/community/grants | Alternative oracle | Partnership |

### What to Include in Applications:

1. **Demo Video/GIF** - Shows working product
2. **Technical Documentation** - Link to GitHub + docs
3. **Competitive Analysis** - Show differentiation
4. **Roadmap** - Clear milestones
5. **Team** - Background and experience
6. **TVS Projections** - Realistic growth metrics

---

## 🚀 Quick Test Commands

```bash
# Check backend health
curl http://your-server:8080/health

# Get live feeds
curl http://your-server:8080/api/feeds

# Get network stats
curl http://your-server:8080/api/stats

# Get chain data
curl http://your-server:8080/api/chains

# Test VRF (if implemented)
curl -X POST http://your-server:8080/api/vrf/request \
  -H "Content-Type: application/json" \
  -d '{"seed": "test-seed-123"}'
```

---

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check logs
journalctl -u obscura-backend -f

# Check if port is in use
netstat -tlnp | grep 8080
```

### Frontend not loading
```bash
# Check nginx
nginx -t
systemctl status nginx

# Check if build exists
ls -la /opt/obscura/frontend/dist/
```

### No testnet tokens
- Try multiple faucets (they have different limits)
- Bridge from Sepolia to L2s (often faster)
- Ask in Discord/Telegram communities for testnet ETH

---

*Last Updated: 2025-12-28*
