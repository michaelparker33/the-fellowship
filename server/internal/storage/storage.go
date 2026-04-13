package storage

import "context"

// FileStorage is the interface for file upload backends (S3, local filesystem, etc.).
type FileStorage interface {
	Upload(ctx context.Context, key string, data []byte, contentType string, filename string) (string, error)
	Delete(ctx context.Context, key string)
	DeleteKeys(ctx context.Context, keys []string)
	KeyFromURL(rawURL string) string
}
