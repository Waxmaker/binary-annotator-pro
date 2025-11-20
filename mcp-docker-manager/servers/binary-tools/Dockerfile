FROM python:3.11-alpine

# Install dependencies
RUN apk add --no-cache gcc musl-dev python3-dev

# Install Python MCP packages
RUN pip install --no-cache-dir mcp httpx

# Create working directory
WORKDIR /app

# Copy the binary annotator MCP server
COPY binary_annotator_mcp.py /app/

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set default environment variables
ENV BINARY_ANNOTATOR_API_URL=http://host.docker.internal:3000
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["/entrypoint.sh"]
