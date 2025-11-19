package main

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/router"
	"binary-annotator-pro/services"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Init DB
	dbpath := ""
	dbpath = os.Getenv("DATABASE_PATH")
	if dbpath == "" {
		dbpath = "./data/ecg_data.db"
	}
	db, err := config.InitDB(dbpath)
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer func() { _ = db.SQLDB.Close() }()

	// Init MCP Service
	mcpService := services.GetMCPService()

	// Try to load MCP config from home directory
	home, err := os.UserHomeDir()
	if err == nil {
		mcpConfigPath := filepath.Join(home, ".mcp.json")
		if _, err := os.Stat(mcpConfigPath); err == nil {
			if err := mcpService.Initialize(mcpConfigPath); err != nil {
				log.Printf("Warning: MCP initialization failed: %v", err)
			} else {
				log.Printf("MCP Service initialized: %d server(s), %d tool(s)",
					mcpService.GetConnectedCount(),
					mcpService.GetToolsCount())
			}
		} else {
			log.Println("No MCP config found at ~/.mcp.json, MCP features disabled")
		}
	}
	defer mcpService.Shutdown()

	// Echo
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Health
	e.GET("/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	// Routes
	router.RegisterRoutes(e, db)

	log.Println("Server starting on :3000")
	if err := e.Start(":3000"); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
