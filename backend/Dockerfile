FROM golang:1.21-alpine as builder

WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o obscura-node main.go

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/obscura-node .
EXPOSE 8080
CMD ["./obscura-node"]
