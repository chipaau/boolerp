//go:build feature

package session

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/redis"
)

// A feature test (C77): sessions in a real Redis at REDIS_TEST_HOST hold neither
// the cookie's token nor Hydra's tokens in readable form, and the tokens' own key
// expires with the session's lifetime (C98).
func TestFeatureSessionsInRedis(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Fatal("REDIS_TEST_HOST is not set; feature tests need Redis (see docs/testing.md)")
	}
	port, _ := strconv.Atoi(cmp.Or(os.Getenv("REDIS_TEST_PORT"), "6379"))
	client := redis.NewClient(redis.Settings{Host: host, Port: port, Timeout: time.Second})
	t.Cleanup(func() { _ = client.Close() })
	const prefix = "bff:feature-test:"
	s := New(client, sealer(t, keyA), Settings{KeyPrefix: prefix, IdleTimeout: time.Minute, Lifetime: time.Hour}, nil)

	cookies := inSession(t, s, nil, func(ctx context.Context) {
		require.NoError(t, s.SignIn(ctx, SignedIn{Account: "account-1", Tokens: Tokens{
			Access: "access-s3cret", Refresh: "refresh-s3cret", IDToken: "id-s3cret",
		}}))
	})
	require.Len(t, cookies, 1)
	token := cookies[0].Value
	ctx := t.Context()

	// The session is stored under the token's SHA-256 hash (scs: base64url).
	hash := sha256.Sum256([]byte(token))
	sessionKey := prefix + "session:" + base64.RawURLEncoding.EncodeToString(hash[:])
	raw, err := client.Get(ctx, sessionKey).Result()
	require.NoError(t, err, "the session is stored under the hashed token")
	assert.Zero(t, client.Exists(ctx, prefix+"session:"+token).Val(), "nothing is stored under the raw token")
	assert.NotContains(t, raw, "s3cret")
	assert.LessOrEqual(t, client.TTL(ctx, sessionKey).Val(), time.Minute, "expires with the idle timeout")

	tokenKeys, err := client.Keys(ctx, prefix+"tokens:*").Result()
	require.NoError(t, err)
	require.Len(t, tokenKeys, 1)
	sealed, err := client.Get(ctx, tokenKeys[0]).Result()
	require.NoError(t, err)
	assert.NotContains(t, sealed, "s3cret", "tokens are sealed")
	ttl := client.TTL(ctx, tokenKeys[0]).Val()
	assert.Greater(t, ttl, 59*time.Minute, "the tokens live as long as the session's lifetime")
	t.Cleanup(func() { client.Del(context.Background(), sessionKey, tokenKeys[0]) })

	inSession(t, s, cookies, func(ctx context.Context) {
		got, ok, err := s.Current(ctx)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, "refresh-s3cret", got.Tokens.Refresh)
		got.Tokens.Refresh = "refresh-2"
		require.NoError(t, s.SaveTokens(ctx, got))
	})
	assert.Greater(t, client.TTL(ctx, tokenKeys[0]).Val(), 59*time.Minute, "a refresh keeps the expiry")
}
