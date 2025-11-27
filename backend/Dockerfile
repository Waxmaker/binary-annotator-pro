# ---- Build Go binary ----
FROM golang:1.25.1-alpine AS builder

RUN apk add --no-cache git gcc musl-dev sqlite-dev
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o binary-annotator-pro .

# ---- Runtime Alpine: Python + Go ----
FROM python:3.12-alpine

# Install build dependencies for Python packages
RUN apk add --no-cache gcc musl-dev linux-headers

WORKDIR /app
COPY ./python_tools /app/python_tools

# Copy Go binary
COPY --from=builder /app/binary-annotator-pro .

# Create data directory
RUN mkdir -p /app/data

RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install --upgrade pip
RUN /app/venv/bin/pip install -r /app/python_tools/requirements.txt

# ENV variables
ENV BINARY_ANNOTATOR_API_URL=http://backend:3000
ENV RAG_API_URL=http://rag-service:3003
ENV MCP_MANAGER_URL=http://mcp-manager:8080
ENV OLLAMA_URL=http://host.docker.internal:11434

EXPOSE 3000

CMD ["./binary-annotator-pro"]

