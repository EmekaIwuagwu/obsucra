# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies for CGO/WASM if needed
RUN apk add --no-cache git build-base

# Copy module files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the node binary
# Enable CGO if using wasmtime-go, otherwise CGO_ENABLED=0 for wazero
RUN CGO_ENABLED=0 GOOS=linux go build -o obscura-node ./cmd/obscura

# Final Stage
FROM alpine:3.19

WORKDIR /root/

# Install certificates and basic tools
RUN apk --no-cache add ca-certificates curl

# Copy binary from builder
COPY --from=builder /app/obscura-node .

# Copy config if exists (or rely on Envs)
# COPY config.yaml .

# Expose ports (API, P2P)
EXPOSE 8080 9000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["./obscura-node"]
