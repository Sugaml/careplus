package outbound

import (
	"context"
	"io"
)

// FileStorage saves files and returns a URL or path to access them.
// Implementations: local (filesystem) or S3.
type FileStorage interface {
	// Save stores the file at the given path (e.g. "photos/2025/02/uuid-name.jpg").
	// Returns the URL or path used to access the file (e.g. /uploads/photos/... or S3 URL).
	Save(ctx context.Context, path string, body io.Reader, contentType string) (url string, err error)
}
