package storage

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

// LocalStorage stores files on the local filesystem.
// Used as a fallback when S3 is not configured (local development).
type LocalStorage struct {
	dir     string // absolute path to upload directory
	baseURL string // URL prefix for serving files (e.g. "http://localhost:8080/uploads")
}

// NewLocalStorage creates a LocalStorage that saves files under dir
// and returns URLs using baseURL.
func NewLocalStorage(dir, baseURL string) *LocalStorage {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		slog.Error("failed to create local upload directory", "dir", dir, "error", err)
		return nil
	}
	slog.Info("local file storage initialized", "dir", dir, "base_url", baseURL)
	return &LocalStorage{dir: dir, baseURL: strings.TrimRight(baseURL, "/")}
}

func (l *LocalStorage) Upload(_ context.Context, key string, data []byte, _ string, _ string) (string, error) {
	path := filepath.Join(l.dir, key)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", fmt.Errorf("local mkdir: %w", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", fmt.Errorf("local write: %w", err)
	}
	return fmt.Sprintf("%s/%s", l.baseURL, key), nil
}

func (l *LocalStorage) Delete(_ context.Context, key string) {
	if key == "" {
		return
	}
	path := filepath.Join(l.dir, key)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		slog.Error("local delete failed", "key", key, "error", err)
	}
}

func (l *LocalStorage) DeleteKeys(ctx context.Context, keys []string) {
	for _, key := range keys {
		l.Delete(ctx, key)
	}
}

func (l *LocalStorage) KeyFromURL(rawURL string) string {
	prefix := l.baseURL + "/"
	if strings.HasPrefix(rawURL, prefix) {
		return strings.TrimPrefix(rawURL, prefix)
	}
	if i := strings.LastIndex(rawURL, "/"); i >= 0 {
		return rawURL[i+1:]
	}
	return rawURL
}
