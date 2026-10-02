package observability

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSensitive(t *testing.T) {
	for _, name := range []string{
		"password", "DB_PASSWORD", "client_secret", "session_token", "credentials",
		"Authorization", "Set-Cookie", "APP_DSN", "api-key", "X-API-Key", "APIKey",
		"private_key", "accessKey", "signing_key", "callbackURL", "APP_REDIS_URL",
		"session_id", "SessionID", "db_passwd", "jwt", "bearer_value", "encryption_key",
	} {
		assert.True(t, sensitive(name), name)
	}
	for _, name := range []string{"service", "port", "user_id", "address", "msg", "url.path", "cache_key", "idempotency_key"} {
		assert.False(t, sensitive(name), name)
	}
}
