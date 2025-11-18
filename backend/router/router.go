package router

import (
	"binary-annotator-pro/config"
	"binary-annotator-pro/handlers"
	"binary-annotator-pro/middleware"

	"github.com/labstack/echo/v4"
)

func RegisterRoutes(e *echo.Echo, db *config.DB) {
	h := handlers.NewHandler(db)

	// Auth routes (public)
	auth := e.Group("/auth")
	auth.POST("/register", h.Register)
	auth.POST("/login", h.Login)
	auth.GET("/me", h.GetCurrentUser, middleware.AuthMiddleware)

	// Uploads
	e.POST("/upload/binary", h.UploadBinary)
	e.POST("/upload/yaml", h.UploadYaml)

	// Gets / lists
	e.GET("/get/list/yaml", h.ListYaml)
	e.GET("/get/list/binary", h.ListBinaries)
	e.GET("/get/binary/:fileName", h.GetBinaryByName)
	e.GET("/get/yaml/:configName", h.GetYamlByName)

	// Delete
	e.DELETE("/delete/binary/:name", h.DeleteBinaryFile)
	e.DELETE("/delete/yaml/:name", h.DeleteYamlConfig)

	// Update
	e.PUT("/update/yaml/:name", h.UpdateYamlConfig)

	// Additional helpers
	e.GET("/get/binary-by-id/:id", h.GetBinaryByID)
}
