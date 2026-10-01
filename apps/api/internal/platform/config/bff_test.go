package config

import (
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSessionKey = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"

// withBFF adds the BFF settings without defaults to a test environment, first,
// so later entries override them.
func withBFF(t *testing.T, environ []string) []string {
	t.Helper()
	required := []string{
		"BFF_REDIS_HOST=redis-sessions",
		"BFF_SESSION_ENCRYPTION_KEY_FILE=" + secretFile(t, testSessionKey),
		"BFF_OIDC_ISSUER=http://identity.bool.test/",
		"BFF_OIDC_CLIENT_ID=erp-app",
		"BFF_OIDC_CLIENT_SECRET_FILE=" + secretFile(t, "client-s3cret"),
	}
	return append(required, environ...)
}

func TestLoadBFFDefaults(t *testing.T) {
	cfg, err := LoadBFF(withBFF(t, nil))
	require.NoError(t, err)
	assert.Equal(t, BFF{
		App: App{Environment: "dev", ListenPort: 8080, ShutdownTimeout: 35 * time.Second},
		Log: Log{Format: "json", Level: slog.LevelInfo},
		HTTP: HTTP{
			MaxBodyBytes:      1 << 20,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       60 * time.Second,
		},
		Redis: Redis{Host: "redis-sessions", Port: 6379, TLS: true, Timeout: 500 * time.Millisecond},
		Session: Session{
			IdleTimeout: 30 * time.Minute, Lifetime: 12 * time.Hour,
			CookieSecure: true, EncryptionKey: testSessionKey,
		},
		OIDC: OIDCClient{
			Issuer: "http://identity.bool.test/", ClientID: "erp-app",
			ClientSecret: "client-s3cret", Audience: "erp-api",
		},
	}, cfg)
}

func TestLoadBFFIgnoresTheAPIsVariables(t *testing.T) {
	cfg, err := LoadBFF(withBFF(t, []string{"APP_PORT=9000", "BFF_PORT=8090"}))
	require.NoError(t, err)
	assert.Equal(t, 8090, cfg.App.ListenPort)
}

func TestLoadBFFRefusesBadSessionSettings(t *testing.T) {
	for name, tc := range map[string]struct {
		environ []string
		want    string
	}{
		"short key":       {[]string{"BFF_SESSION_ENCRYPTION_KEY_FILE=" + secretFile(t, "abcd")}, "BFF_SESSION_ENCRYPTION_KEY_FILE: must satisfy len=64"},
		"non-hex key":     {[]string{"BFF_SESSION_ENCRYPTION_KEY_FILE=" + secretFile(t, strings.Repeat("z", 64))}, "BFF_SESSION_ENCRYPTION_KEY_FILE: must satisfy hexadecimal"},
		"lifetime < idle": {[]string{"BFF_SESSION_IDLE_TIMEOUT=2h", "BFF_SESSION_LIFETIME=1h"}, "BFF_SESSION_LIFETIME: must satisfy gtfield=BFF_SESSION_IDLE_TIMEOUT"},
		"no client":       {[]string{"BFF_OIDC_CLIENT_ID="}, "BFF_OIDC_CLIENT_ID"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := LoadBFF(withBFF(t, tc.environ))
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.want)
			assert.NotContains(t, err.Error(), "zzzz", "the key is never echoed")
		})
	}
}
