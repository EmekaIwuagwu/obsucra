#!/bin/bash
# ============================================================================
# Obscura Oracle - Digital Ocean / Linux VPS Deployment Script
# ============================================================================
# Usage: curl -sSL https://raw.githubusercontent.com/obscura-network/obscura/main/scripts/deploy.sh | bash
# ============================================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    OBSCURA ORACLE                             ║"
echo "║           Enterprise-Grade Privacy Oracle Network             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================================
# Pre-flight checks
# ============================================================================
echo -e "${YELLOW}[1/8]${NC} Running pre-flight checks..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}✓ OS detected: $OS${NC}"

# ============================================================================
# Install Docker
# ============================================================================
echo -e "${YELLOW}[2/8]${NC} Installing Docker..."

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker already installed${NC}"
else
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓ Docker installed${NC}"
fi

# Install Docker Compose
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
else
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
fi

# ============================================================================
# Install Go (for building from source)
# ============================================================================
echo -e "${YELLOW}[3/8]${NC} Installing Go..."

if command -v go &> /dev/null; then
    echo -e "${GREEN}✓ Go already installed${NC}"
else
    wget -q https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
    tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
    rm go1.22.0.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
    echo -e "${GREEN}✓ Go 1.22 installed${NC}"
fi

# ============================================================================
# Install Node.js
# ============================================================================
echo -e "${YELLOW}[4/8]${NC} Installing Node.js..."

if command -v node &> /dev/null; then
    echo -e "${GREEN}✓ Node.js already installed${NC}"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js 20 installed${NC}"
fi

# ============================================================================
# Clone Obscura
# ============================================================================
echo -e "${YELLOW}[5/8]${NC} Cloning Obscura repository..."

INSTALL_DIR=/opt/obscura

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory exists, updating...${NC}"
    cd $INSTALL_DIR
    git pull origin main
else
    git clone https://github.com/obscura-network/obscura.git $INSTALL_DIR
    cd $INSTALL_DIR
fi

echo -e "${GREEN}✓ Repository ready${NC}"

# ============================================================================
# Build Backend
# ============================================================================
echo -e "${YELLOW}[6/8]${NC} Building backend..."

cd $INSTALL_DIR/backend
export PATH=$PATH:/usr/local/go/bin
go build -o obscura-node ./cmd/obscura

echo -e "${GREEN}✓ Backend built${NC}"

# ============================================================================
# Build Frontend
# ============================================================================
echo -e "${YELLOW}[7/8]${NC} Building frontend..."

cd $INSTALL_DIR/frontend
npm install --legacy-peer-deps
npm run build

echo -e "${GREEN}✓ Frontend built${NC}"

# ============================================================================
# Setup Services
# ============================================================================
echo -e "${YELLOW}[8/8]${NC} Setting up systemd services..."

# Backend service
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
Environment=OBSCURA_LOG_LEVEL=info
Environment=OBSCURA_TELEMETRY_MODE=true

[Install]
WantedBy=multi-user.target
EOF

# Enable and start backend
systemctl daemon-reload
systemctl enable obscura-backend
systemctl start obscura-backend

# Install and configure Nginx
apt-get install -y nginx

cat > /etc/nginx/sites-available/obscura << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/obscura/frontend/dist;
    index index.html;
    
    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:8080/health;
    }
    
    # Metrics
    location /metrics {
        proxy_pass http://localhost:8080/metrics;
    }
}
EOF

ln -sf /etc/nginx/sites-available/obscura /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Setup firewall
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 22/tcp
    ufw --force enable
fi

echo -e "${GREEN}✓ Services configured${NC}"

# ============================================================================
# Completion
# ============================================================================
PUBLIC_IP=$(curl -s ifconfig.me)

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              DEPLOYMENT COMPLETE! 🎉                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${CYAN}Access your Obscura Oracle dashboard:${NC}"
echo -e "   🌐 Dashboard:  ${GREEN}http://$PUBLIC_IP${NC}"
echo -e "   📊 API:        ${GREEN}http://$PUBLIC_IP/api/stats${NC}"
echo -e "   ❤️  Health:     ${GREEN}http://$PUBLIC_IP/health${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Configure .env with your RPC endpoints and private key"
echo "   2. Deploy smart contracts to testnets"
echo "   3. Fund your node wallet with testnet ETH"
echo "   4. (Optional) Setup SSL with: certbot --nginx"
echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo "   View logs:    journalctl -u obscura-backend -f"
echo "   Restart:      systemctl restart obscura-backend"
echo "   Status:       systemctl status obscura-backend"
echo ""
