package observability

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
)

func TestLoggerRedactsAttributesAndGroups(t *testing.T) {
	const secret = "never-print-this-value"
	for _, format := range []string{"json", "text"} {
		t.Run(format, func(t *testing.T) {
			var output bytes.Buffer
			logger := NewLogger(&output, format, slog.LevelInfo).
				With("service", "api", "password", secret).
				With("connection", slog.GroupValue(slog.String("APP_DSN", secret)))
			logger.Info("Started", "port", 8080,
				"APP_REDIS_URL", secret,
				"client_secret", secret,
				"session_token", secret,
				"Authorization", secret,
				"Set-Cookie", secret,
				"X-API-Key", secret,
				"private_key", secret,
				"accessKey", secret,
				"signing_key", secret,
				slog.Group("credentials", "value", secret),
				slog.Group("nested", slog.Group("token", "value", secret)),
			)
			logger.WithGroup("credentials").With("stored", secret).Info("Checked", "value", secret)

			if strings.Contains(output.String(), secret) {
				t.Fatal("structured logs exposed a sensitive value")
			}
			if !strings.Contains(output.String(), "[REDACTED]") {
				t.Fatal("missing redaction marker")
			}
			if format == "json" {
				var record map[string]any
				if err := json.NewDecoder(&output).Decode(&record); err != nil {
					t.Fatal(err)
				}
				if record["service"] != "api" || record["port"] != float64(8080) || record["msg"] != "Started" {
					t.Fatalf("safe log fields were not preserved: %v", record)
				}
			} else if !strings.Contains(output.String(), "service=api") || !strings.Contains(output.String(), "port=8080") {
				t.Fatal("safe text fields were not preserved")
			}
		})
	}
}

func TestLoggerFiltersLevels(t *testing.T) {
	for _, level := range []slog.Level{slog.LevelDebug, slog.LevelInfo, slog.LevelWarn, slog.LevelError} {
		t.Run(level.String(), func(t *testing.T) {
			var output bytes.Buffer
			logger := NewLogger(&output, "json", level)
			logger.Debug("debug event")
			logger.Info("info event")
			logger.Warn("warn event")
			logger.Error("error event")
			for _, candidate := range []slog.Level{slog.LevelDebug, slog.LevelInfo, slog.LevelWarn, slog.LevelError} {
				present := strings.Contains(output.String(), strings.ToLower(candidate.String())+" event")
				if present != (candidate >= level) {
					t.Errorf("level %s: event presence was %v", candidate, present)
				}
			}
		})
	}
}
