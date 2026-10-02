//go:build feature

package redis

import (
	"cmp"
	"context"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A feature test (C77): it needs a real Redis at REDIS_TEST_HOST.
func TestFeatureClientAgainstRedis(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Fatal("REDIS_TEST_HOST is not set; feature tests need Redis (see docs/testing.md)")
	}
	port, _ := strconv.Atoi(cmp.Or(os.Getenv("REDIS_TEST_PORT"), "6379"))
	client := NewClient(Settings{Host: host, Port: port, Timeout: time.Second})
	ctx := t.Context()

	key := "test:" + strconv.FormatInt(time.Now().UnixNano(), 10)
	require.NoError(t, client.Set(ctx, key, "value", time.Minute).Err())
	got, err := client.Get(ctx, key).Result()
	require.NoError(t, err)
	assert.Equal(t, "value", got)
	require.NoError(t, client.Del(ctx, key).Err())

	require.NoError(t, client.Close())
	assert.Error(t, client.Ping(context.Background()).Err(), "a closed client refuses commands")
}
