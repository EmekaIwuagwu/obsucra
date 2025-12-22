#!/bin/bash
echo "Deploying Obscura Backend..."

# Build Docker Image
docker build -t obscura-node ./backend

# Run Container
docker run -d \
  --name obscura-node-1 \
  -p 8080:8080 \
  -e LOG_LEVEL=debug \
  -v $(pwd)/config:/app/config \
  obscura-node

echo "Node started on port 8080"
