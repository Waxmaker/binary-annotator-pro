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

	// Binary chunk loading (for HexViewer)
	e.GET("/binary/:id/chunk", h.GetBinaryChunk)

	// Binary analysis
	e.GET("/analysis/trigrams/:name", h.GetBinaryTrigrams)

	// Compression detection
	e.POST("/analysis/compression/:fileId", h.StartCompressionAnalysis)
	e.GET("/analysis/compression/:analysisId", h.GetCompressionAnalysis)
	e.GET("/analysis/compression/file/:fileId", h.GetFileCompressionAnalyses)
	e.GET("/analysis/compression/file/:fileId/latest", h.GetLatestCompressionAnalysis)
	e.GET("/analysis/compression/download/:resultId", h.DownloadDecompressedFile)
	e.POST("/analysis/compression/result/:resultId/add-to-files", h.AddDecompressedToFiles)
	e.POST("/analysis/compression/result/:resultId/reconstruct", h.ReconstructFileWithDecompression)
	e.DELETE("/analysis/compression/:analysisId", h.DeleteCompressionAnalysis)

	// Decompressed files management
	e.GET("/decompressed/list", h.ListDecompressedFiles)
	e.GET("/decompressed/:id/data", h.GetDecompressedFileData)

	// Delete
	e.DELETE("/delete/binary/:name", h.DeleteBinaryFile)
	e.DELETE("/delete/yaml/:name", h.DeleteYamlConfig)

	// Update
	e.PUT("/update/yaml/:name", h.UpdateYamlConfig)
	e.PUT("/rename/binary/:name", h.RenameBinaryFile)

	// Additional helpers
	e.GET("/get/binary-by-id/:id", h.GetBinaryByID)

	// AI Settings
	aiSettingsHandler := handlers.NewAISettingsHandler(db)
	e.GET("/ai/settings/:userId", aiSettingsHandler.GetAISettings)
	e.POST("/ai/settings/:userId", aiSettingsHandler.SaveAISettings)
	e.PUT("/ai/settings/:userId", aiSettingsHandler.SaveAISettings)
	e.DELETE("/ai/settings/:userId", aiSettingsHandler.DeleteAISettings)
	e.POST("/ai/test/:userId", aiSettingsHandler.TestAIConnection)

	// AI WebSocket
	wsHandler := handlers.NewWebSocketHandler(db)
	e.GET("/ws/ai", wsHandler.HandleAI)

	// Chat
	chatHandler := handlers.NewChatHandler(db)
	e.GET("/ws/chat", chatHandler.HandleChat)
	e.GET("/chat/sessions/:userId", chatHandler.GetChatSessions)
	e.DELETE("/chat/session/:sessionId", chatHandler.DeleteChatSession)

	// Binary Search
	searchHandler := handlers.NewSearchHandler(db)
	e.POST("/search", searchHandler.Search)

	// Checksum calculation
	e.POST("/checksum", h.CalculateChecksum)

	// Binary Comparison
	e.POST("/compare/diff", h.CompareBinaryFiles)
	e.POST("/compare/delta", h.AnalyzeDelta)
	e.POST("/compare/correlation", h.CalculatePatternCorrelation)
	e.POST("/compare/streaming", h.StreamingCompare)
	e.GET("/compare/export", h.ExportComparison)

	// Multi-file comparison
	e.POST("/compare/multi", h.CompareMultipleFiles)
	e.POST("/compare/multi/generate-yaml", h.GenerateMultiFileDiffYaml)

	// MCP Docker Manager
	mcpDockerHandler := handlers.NewMCPDockerHandler()
	e.GET("/mcp/docker/health", mcpDockerHandler.GetMCPManagerHealth)
	e.GET("/mcp/docker/stats", mcpDockerHandler.GetMCPDockerStats)
	e.GET("/mcp/docker/servers", mcpDockerHandler.ListMCPServers)
	e.POST("/mcp/docker/servers/:name/start", mcpDockerHandler.StartMCPServer)
	e.POST("/mcp/docker/servers/:name/stop", mcpDockerHandler.StopMCPServer)
	e.POST("/mcp/docker/servers/:name/toggle", mcpDockerHandler.ToggleMCPDockerServer)
	e.POST("/mcp/docker/servers/:name/call", mcpDockerHandler.CallMCPTool)

	// RAG Document Management
	ragFilesHandler := handlers.NewRAGFilesHandler(db)
	e.POST("/rag/upload", ragFilesHandler.UploadDocument)
	e.GET("/rag/documents", ragFilesHandler.ListDocuments)
	e.DELETE("/rag/documents/:id", ragFilesHandler.DeleteDocument)
	e.GET("/rag/stats", ragFilesHandler.GetDocumentStats)
	e.POST("/rag/search", ragFilesHandler.SearchRAG)

	// CSV Processing
	e.POST("/parse/csv", h.ParseCSV)

	// ECG Conversion
	e.POST("/convert/ecg", h.ConvertECGData)

	// Huffman Tables
	e.POST("/huffman/tables", h.CreateHuffmanTable)
	e.GET("/huffman/tables", h.ListHuffmanTables)
	e.GET("/huffman/tables/:id", h.GetHuffmanTable)
	e.GET("/huffman/tables/name/:name", h.GetHuffmanTableByName)
	e.PUT("/huffman/tables/:id", h.UpdateHuffmanTable)
	e.DELETE("/huffman/tables/:id", h.DeleteHuffmanTable)
	e.POST("/huffman/decode", h.DecodeHuffmanSelection)
	e.POST("/huffman/analyze", h.AnalyzeHuffmanPatterns)

}
