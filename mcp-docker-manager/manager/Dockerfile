FROM golang:1.23-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY *.go ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o mcp-manager .

# Final stage
FROM alpine:latest

# Install Docker CLI and other dependencies
RUN apk --no-cache add ca-certificates docker-cli

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /build/mcp-manager .

# Expose the API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./mcp-manager"]
