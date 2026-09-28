package observability

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// decode parses a single JSON log line.
func decode(t *testing.T, buf *bytes.Buffer) map[string]any {
	t.Helper()
	var line map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &line))
	return line
}

func TestNewLoggerJSON(t *testing.T) {
	var buf bytes.Buffer
	NewLogger(&buf, "json", slog.LevelInfo).Info("started", "port", 8080)

	line := decode(t, &buf)
	assert.Equal(t, "INFO", line["level"])
	assert.Equal(t, "started", line["msg"])
	assert.EqualValues(t, 8080, line["port"])
}

func TestNewLoggerText(t *testing.T) {
	var buf bytes.Buffer
	NewLogger(&buf, "text", slog.LevelInfo).Info("started", "port", 8080)

	assert.Contains(t, buf.String(), "level=INFO msg=started port=8080")
}

func TestNewLoggerLevels(t *testing.T) {
	levels := []slog.Level{slog.LevelDebug, slog.LevelInfo, slog.LevelWarn, slog.LevelError}
	for _, threshold := range levels {
		t.Run(threshold.String(), func(t *testing.T) {
			var buf bytes.Buffer
			logger := NewLogger(&buf, "json", threshold)
			for _, level := range levels {
				buf.Reset()
				logger.Log(t.Context(), level, "event")
				assert.Equal(t, level >= threshold, buf.Len() > 0, "event at %s", level)
			}
		})
	}
}

// TestRedaction logs one secret through every path slog offers: call-site
// attributes, With, nested groups, WithGroup, and a group value. It checks both
// formats, because each handler writes attributes its own way.
func TestRedaction(t *testing.T) {
	const secret = "never-print-this-value"
	for _, format := range []string{"json", "text"} {
		t.Run(format, func(t *testing.T) {
			var buf bytes.Buffer
			logger := NewLogger(&buf, format, slog.LevelInfo).
				With("service", "api", "password", secret).
				With("connection", slog.GroupValue(slog.String("APP_DSN", secret)))

			logger.Info("started", "port", 8080,
				"client_secret", secret,
				"X-API-Key", secret,
				"callbackURL", secret,
				slog.Group("credentials", "value", secret),
				slog.Group("nested", slog.Group("token", "value", secret)),
			)
			logger.WithGroup("credentials").With("stored", secret).Info("checked", "value", secret)

			out := buf.String()
			assert.NotContains(t, out, secret)
			assert.Contains(t, out, Redacted)
			// Safe fields survive.
			assert.Contains(t, out, "api")
			assert.Contains(t, out, "8080")
		})
	}
}

func TestRedactionKeepsSafeAttributes(t *testing.T) {
	var buf bytes.Buffer
	NewLogger(&buf, "json", slog.LevelInfo).Info("event", "user_id", "u-1", "port", 8080)

	line := decode(t, &buf)
	assert.Equal(t, "u-1", line["user_id"])
	assert.EqualValues(t, 8080, line["port"])
}
