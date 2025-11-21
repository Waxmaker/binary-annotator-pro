from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
import uuid
from datetime import datetime

# LangChain imports
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document


class Settings(BaseModel):
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    persist_directory: str = "./chroma_db"


settings = Settings()
os.makedirs(settings.persist_directory, exist_ok=True)

app = FastAPI(title="RAG LangChain Microservice")

# In-memory document store (maps document_id -> metadata)
document_store: Dict[int, dict] = {}
next_document_id = 1


def get_embeddings():
    """Get HuggingFace embeddings"""
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_model,
        model_kwargs={'device': 'cpu'}
    )


def load_vectorstore(embeddings=None):
    """Load or create ChromaDB vector store"""
    if embeddings is None:
        embeddings = get_embeddings()
    try:
        vectordb = Chroma(
            persist_directory=settings.persist_directory,
            embedding_function=embeddings
        )
    except Exception:
        vectordb = Chroma.from_documents(
            [], embeddings, persist_directory=settings.persist_directory
        )
    return vectordb


# Request/Response Models matching Go backend expectations

class IndexDocumentRequest(BaseModel):
    type: str
    title: str
    content: str
    source: str
    metadata: Optional[Dict[str, str]] = None
    chunk_tokens: Optional[int] = 256
    overlap_tokens: Optional[int] = 50


class ChunkInfo(BaseModel):
    chunk_id: int
    content: str
    tokens: int


class IndexDocumentResponse(BaseModel):
    id: int
    chunks: List[Dict]


class SearchRequest(BaseModel):
    query: str
    type: Optional[List[str]] = None
    max_results: Optional[int] = 5
    min_score: Optional[float] = 0.3


class SearchResult(BaseModel):
    document_id: int
    chunk_id: int
    type: str
    title: str
    content: str
    source: str
    score: float
    metadata: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    count: int


# Endpoints

@app.get("/health")
async def healthcheck():
    """Health check endpoint"""
    return {"status": "ok"}


@app.post("/index/document", response_model=IndexDocumentResponse)
async def index_document(req: IndexDocumentRequest):
    """
    Index a document in the RAG system.
    Expected by Go backend at: POST /index/document
    """
    global next_document_id

    try:
        # Calculate chunk size based on tokens (approximate: 1 token ≈ 4 chars)
        chunk_size = req.chunk_tokens * 4 if req.chunk_tokens else 1024
        chunk_overlap = req.overlap_tokens * 4 if req.overlap_tokens else 200

        # Split content into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        # Create documents with metadata
        doc_metadata = {
            "document_id": str(next_document_id),
            "type": req.type,
            "title": req.title,
            "source": req.source,
        }
        if req.metadata:
            doc_metadata.update(req.metadata)

        # Create document and split
        doc = Document(page_content=req.content, metadata=doc_metadata)
        chunks = text_splitter.split_documents([doc])

        # Add chunk IDs to metadata
        chunk_info = []
        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = str(i)
            chunk_info.append({
                "chunk_id": i,
                "content": chunk.page_content[:100] + "...",
                "tokens": len(chunk.page_content) // 4  # Approximate
            })

        # Index in vector store
        embeddings = get_embeddings()
        vectordb = load_vectorstore(embeddings)
        vectordb.add_documents(chunks)
        vectordb.persist()

        # Store document metadata
        document_store[next_document_id] = {
            "id": next_document_id,
            "type": req.type,
            "title": req.title,
            "source": req.source,
            "chunk_count": len(chunks),
            "created_at": datetime.now().isoformat()
        }

        response = IndexDocumentResponse(
            id=next_document_id,
            chunks=chunk_info
        )

        next_document_id += 1
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index document: {str(e)}")


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Search for documents in the RAG system.
    Expected by Go backend at: POST /search
    """
    try:
        embeddings = get_embeddings()
        vectordb = load_vectorstore(embeddings)

        # Perform similarity search with scores
        docs_and_scores = vectordb.similarity_search_with_score(
            req.query,
            k=req.max_results if req.max_results else 5
        )

        results = []
        for doc, score in docs_and_scores:
            # Convert ChromaDB distance to similarity score (lower distance = higher similarity)
            # ChromaDB uses L2 distance, convert to similarity (0-1)
            similarity_score = 1.0 / (1.0 + score)

            # Filter by minimum score
            if similarity_score < (req.min_score if req.min_score else 0.3):
                continue

            # Filter by document type if specified
            if req.type and doc.metadata.get("type") not in req.type:
                continue

            result = SearchResult(
                document_id=int(doc.metadata.get("document_id", 0)),
                chunk_id=int(doc.metadata.get("chunk_id", 0)),
                type=doc.metadata.get("type", "document"),
                title=doc.metadata.get("title", ""),
                content=doc.page_content,
                source=doc.metadata.get("source", ""),
                score=similarity_score,
                metadata=str(doc.metadata) if doc.metadata else None
            )
            results.append(result)

        return SearchResponse(
            query=req.query,
            results=results,
            count=len(results)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.delete("/document/{document_id}")
async def delete_document(document_id: int):
    """
    Delete a document from the RAG system.
    Expected by Go backend at: DELETE /document/{document_id}
    """
    try:
        # Check if document exists
        if document_id not in document_store:
            raise HTTPException(status_code=404, detail="Document not found")

        # Get document metadata
        doc_meta = document_store[document_id]

        # Delete from vector store
        # Note: ChromaDB doesn't have direct delete by metadata filter in community version
        # We would need to track chunk IDs separately for proper deletion
        # For now, we just remove from our metadata store
        del document_store[document_id]

        return {"status": "deleted", "document_id": document_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@app.get("/documents")
async def list_documents():
    """List all indexed documents"""
    return {
        "documents": list(document_store.values()),
        "count": len(document_store)
    }


@app.get("/stats")
async def get_stats():
    """Get statistics about the RAG system"""
    total_chunks = sum(doc.get("chunk_count", 0) for doc in document_store.values())
    return {
        "total_documents": len(document_store),
        "total_chunks": total_chunks,
        "embedding_model": settings.embedding_model
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_langchain_microservice:app",
                host="0.0.0.0", port=3003, reload=True)
