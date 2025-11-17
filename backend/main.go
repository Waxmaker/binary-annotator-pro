package main

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/router"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Init DB
	db, err := config.InitDB("ecg_data.db")
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	defer func() { _ = db.SQLDB.Close() }()

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
