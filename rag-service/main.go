package main

import (
	"fmt"
	"log"
	"os"

	"binary-annotator-pro/rag-service/api"
	"binary-annotator-pro/rag-service/indexer"
	"binary-annotator-pro/rag-service/storage"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const (
	DefaultPort = "3003"
)

func main() {
	// Get configuration from environment
	port := os.Getenv("RAG_PORT")
	if port == "" {
		port = DefaultPort
	}

	// Database configuration
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "rag_db"
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "rag_user"
	}

	dbPassword := os.Getenv("DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "rag_password"
	}

	// Build DSN
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	// Initialize storage
	store, err := storage.NewVectorStore(dsn)
	if err != nil {
		log.Fatalf("Failed to initialize vector store: %v", err)
	}
	defer store.Close()

	// Initialize indexer
	idx := indexer.NewIndexer(store)

	// Create Echo instance
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Initialize API handlers
	apiHandler := api.NewHandler(idx, store)

	// Routes
	e.GET("/health", apiHandler.Health)
	e.POST("/index/document", apiHandler.IndexDocument)
	e.POST("/index/yaml", apiHandler.IndexYAML)
	e.POST("/index/analysis", apiHandler.IndexAnalysis)
	e.POST("/index/batch", apiHandler.IndexBatch)
	e.POST("/search", apiHandler.Search)
	e.GET("/documents", apiHandler.ListDocuments)
	e.GET("/documents/:id", apiHandler.GetDocument)
	e.DELETE("/documents/:id", apiHandler.DeleteDocument)
	e.POST("/clear", apiHandler.ClearIndex)
	e.GET("/stats", apiHandler.GetStats)
	e.GET("/config", apiHandler.GetConfig)
	e.POST("/config", apiHandler.UpdateConfig)

	// Start server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("RAG Service starting on %s", addr)
	log.Printf("Database: %s:%s/%s", dbHost, dbPort, dbName)
	log.Printf("Ollama: %s (model: %s)", os.Getenv("OLLAMA_BASE_URL"), os.Getenv("OLLAMA_EMBED_MODEL"))

	if err := e.Start(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
