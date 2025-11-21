# Use Python 3.10+ for compatibility with modern type hints
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install dependencies FIRST
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your source code
COPY src/ /app/src/

# Create directories for uploads and chroma_db
RUN mkdir -p /app/uploads /app/chroma_db

# Expose the port
EXPOSE 3003

# Command to run the application using uvicorn
CMD ["uvicorn", "src.rag_langchain_microservice:app", "--host", "0.0.0.0", "--port", "3003"]
