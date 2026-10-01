//go:build feature

package session

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/redis"
)

// A feature test (C77): sessions in a real Redis at REDIS_TEST_HOST hold neither
// the cookie's token nor Hydra's tokens in readable form.
func TestFeatureSessionsInRedis(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Fatal("REDIS_TEST_HOST is not set; feature tests need Redis (see docs/testing.md)")
	}
	port, _ := strconv.Atoi(cmp.Or(os.Getenv("REDIS_TEST_PORT"), "6379"))
	client := redis.NewClient(redis.Settings{Host: host, Port: port, Timeout: time.Second})
	t.Cleanup(func() { _ = client.Close() })
	const prefix = "bff:test-client:session:"
	s := New(client, sealer(t, keyA), Settings{KeyPrefix: prefix, IdleTimeout: time.Minute, Lifetime: time.Hour}, nil)

	cookies := inSession(t, s, nil, func(ctx context.Context) {
		require.NoError(t, s.SignIn(ctx, SignedIn{Account: "account-1", Tokens: Tokens{
			Access: "access-s3cret", Refresh: "refresh-s3cret", IDToken: "id-s3cret",
		}}))
	})
	require.Len(t, cookies, 1)
	token := cookies[0].Value

	// Stored under the instance's prefix and the token's SHA-256 hash (scs:
	// base64url), never the token itself.
	hash := sha256.Sum256([]byte(token))
	key := prefix + base64.RawURLEncoding.EncodeToString(hash[:])
	ctx := t.Context()
	raw, err := client.Get(ctx, key).Result()
	require.NoError(t, err, "the session is stored under the hashed token")
	t.Cleanup(func() { client.Del(context.Background(), key) })
	assert.Zero(t, client.Exists(ctx, prefix+token).Val(), "nothing is stored under the raw token")
	assert.False(t, strings.Contains(raw, "s3cret"), "tokens are not readable in Redis")
	assert.LessOrEqual(t, client.TTL(ctx, key).Val(), time.Minute, "expires with the idle timeout")

	inSession(t, s, cookies, func(ctx context.Context) {
		got, ok, err := s.Current(ctx)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, "refresh-s3cret", got.Tokens.Refresh)
	})
}
