FROM node:20-alpine

# Install filesystem MCP server
RUN npm install -g @modelcontextprotocol/server-filesystem

# Create entrypoint wrapper to keep stdin open
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set working directory
WORKDIR /data

# Run with stdin open
ENTRYPOINT ["/entrypoint.sh"]
