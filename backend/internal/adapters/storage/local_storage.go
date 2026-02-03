package storage

import (
	"context"
	"io"
	"os"
	"path/filepath"

	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
)

// LocalStorage saves files to the local filesystem under FS.LocalBaseDir.
type LocalStorage struct {
	baseDir string
	baseURL string
}

func NewLocalStorage(cfg config.FSConfig) *LocalStorage {
	return &LocalStorage{
		baseDir: cfg.LocalBaseDir,
		baseURL: cfg.LocalBaseURL,
	}
}

func (s *LocalStorage) Save(ctx context.Context, path string, body io.Reader, _ string) (string, error) {
	fullPath := filepath.Join(s.baseDir, path)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	f, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, body); err != nil {
		_ = os.Remove(fullPath)
		return "", err
	}
	// Return URL path for serving (e.g. /uploads/photos/2025/02/uuid.jpg)
	url := s.baseURL + "/" + path
	if filepath.Separator == '\\' {
		url = s.baseURL + "/" + filepath.ToSlash(path)
	}
	return url, nil
}
