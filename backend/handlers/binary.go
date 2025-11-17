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
