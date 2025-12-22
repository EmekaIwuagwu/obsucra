.PHONY: all test clean deploy-backend deploy-contracts

all: build

build:
	@echo "Building Backend..."
	cd backend && go build -o ../bin/obscura-node ./cmd/node
	@echo "Building Contracts..."
	cd contracts && npx hardhat compile
	@echo "Building Frontend..."
	cd frontend && npm run build

test:
	@echo "Running Backend Tests..."
	cd backend && go test ./...
	@echo "Running Contract Tests..."
	cd contracts && npx hardhat test

deploy-testnet:
	@echo "Deploying to Sepolia..."
	cd contracts && npx hardhat run scripts/deploy.js --network sepolia

deploy-local:
	@echo "Starting Docker Stack..."
	docker-compose up -d

clean:
	rm -rf bin
	cd contracts && npx hardhat clean
