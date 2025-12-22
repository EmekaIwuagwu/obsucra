.PHONY: backend frontend contracts test

all: backend frontend

backend:
	cd backend && go build -o ../bin/obscura-node main.go

frontend:
	cd frontend && npm install && npm run build

contracts:
	cd contracts && npx hardhat compile

test:
	go test ./backend/...
	cd frontend && npm test
	cd contracts && npx hardhat test

docker-build:
	docker build -t obscura-network/node ./backend
	docker build -t obscura-network/dashboard ./frontend
