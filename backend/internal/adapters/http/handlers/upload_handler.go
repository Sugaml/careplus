package handlers

import (
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const (
	maxUploadSize = 10 << 20 // 10 MiB
)

// Allowed MIME types for photos and general files.
var allowedTypes = map[string]bool{
	"image/jpeg": true, "image/png": true, "image/gif": true,
	"image/webp": true, "image/svg+xml": true,
	"application/pdf": true,
	"application/msword": true, "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
}

type UploadHandler struct {
	storage outbound.FileStorage
	logger  *zap.Logger
}

func NewUploadHandler(storage outbound.FileStorage, logger *zap.Logger) *UploadHandler {
	return &UploadHandler{storage: storage, logger: logger}
}

// Upload handles POST multipart/form-data with field "file" or "photo".
// Returns { "url": "...", "path": "...", "filename": "..." }.
func (h *UploadHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		file, err = c.FormFile("photo")
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "missing file or photo in form"})
		return
	}
	if file.Size > maxUploadSize {
		c.JSON(http.StatusRequestEntityTooLarge, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "file too large (max 10MB)"})
		return
	}
	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "failed to read file"})
		return
	}
	defer f.Close()

	contentType := file.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if !allowedTypes[contentType] && !strings.HasPrefix(contentType, "image/") {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "file type not allowed"})
		return
	}

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".bin"
	}
	now := time.Now()
	subdir := "files"
	if strings.HasPrefix(contentType, "image/") {
		subdir = "photos"
	}
	path := subdir + "/" + now.Format("2006/01") + "/" + uuid.New().String() + ext

	url, err := h.storage.Save(c.Request.Context(), path, f, contentType)
	if err != nil {
		h.logger.Error("upload save failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "upload failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"url":      url,
		"path":     path,
		"filename": file.Filename,
	})
}
