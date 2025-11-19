# ---- Build Go binary ----
FROM golang:1.25.1-alpine AS builder

RUN apk add --no-cache git gcc musl-dev sqlite-dev
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o binary-annotator-pro .

# ---- Runtime Alpine: Python + Go ----
FROM alpine:3.20

WORKDIR /app

# Install Python + build tools
RUN apk add --no-cache \
  python3 \
  py3-pip \
  py3-virtualenv \
  py3-setuptools \
  py3-wheel \
  gcc \
  musl-dev \
  python3-dev \
  sqlite-libs

# Create a Python virtual environment
RUN python3 -m venv /app/venv

# Activate venv and install deps
COPY ./mcp-server/requirements.txt .
RUN /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy MCP server code
COPY ./mcp-server/binary_annotator_mcp.py .

# Copy Go binary
COPY --from=builder /app/binary-annotator-pro .

# Create data directory
RUN mkdir -p /app/data

# ENV variables
ENV BINARY_ANNOTATOR_API_URL=http://backend:3000
ENV OLLAMA_URL=http://host.docker.internal:11434

# Add venv to PATH so the Go process can call python + libs
ENV PATH="/app/venv/bin:$PATH"

EXPOSE 3000

CMD ["./binary-annotator-pro"]

