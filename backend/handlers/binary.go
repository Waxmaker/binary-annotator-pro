package handlers

import (
	"binary-annotator-pro/models"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

type DeleteBinaryRequest struct {
	Name string `param:"name"`
}

func (h *Handler) DeleteBinaryFile(c echo.Context) error {
	name := c.Param("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "missing file name",
		})
	}
	fmt.Printf("Deleting binary file: %s\n", name)

	// Delete from DB (hard delete with Unscoped to allow re-uploading with same name)
	res := h.db.GormDB.Unscoped().Where("name = ?", name).Delete(&models.File{})
	if res.Error != nil {
		fmt.Printf("Error deleting file from DB: %v\n", res.Error)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": res.Error.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "file deleted",
		"file":    name,
	})
}

// RenameBinaryFile renames a binary file
func (h *Handler) RenameBinaryFile(c echo.Context) error {
	oldName := c.Param("name")
	if oldName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "name required"})
	}

	var req struct {
		NewName string `json:"new_name"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.NewName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "new_name required"})
	}

	fmt.Printf("Renaming binary file: %s -> %s\n", oldName, req.NewName)

	// Check if old file exists
	var file models.File
	if err := h.db.GormDB.Where("name = ?", oldName).First(&file).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "file not found"})
	}

	// Check if new name already exists
	var existing models.File
	if err := h.db.GormDB.Where("name = ?", req.NewName).First(&existing).Error; err == nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "file with new name already exists"})
	}

	// Update the file name
	file.Name = req.NewName
	if err := h.db.GormDB.Save(&file).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message":  "renamed",
		"old_name": oldName,
		"new_name": req.NewName,
	})
}
