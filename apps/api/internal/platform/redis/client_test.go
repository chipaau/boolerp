package redis

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// settings returns settings for a server that is not running.
func settings() Settings {
	return Settings{Host: "127.0.0.1", Port: 1, Timeout: 200 * time.Millisecond}
}

func TestNewClientAppliesSettings(t *testing.T) {
	s := settings()
	s.Username, s.Password, s.DB, s.TLS = "cache", "s3cret", 3, true
	opts := NewClient(s).Options()

	assert.Equal(t, "127.0.0.1:1", opts.Addr)
	assert.Equal(t, "cache", opts.Username)
	assert.Equal(t, "s3cret", opts.Password)
	assert.Equal(t, 3, opts.DB)
	require.NotNil(t, opts.TLSConfig)
	assert.Equal(t, "127.0.0.1", opts.TLSConfig.ServerName, "the certificate is verified against the host")
	assert.False(t, opts.TLSConfig.InsecureSkipVerify)

	s.TLS = false
	assert.Nil(t, NewClient(s).Options().TLSConfig)
}

func TestNewClientFailsFast(t *testing.T) {
	opts := NewClient(settings()).Options()
	assert.Equal(t, 200*time.Millisecond, opts.DialTimeout)
	assert.Equal(t, 200*time.Millisecond, opts.ReadTimeout)
	assert.Equal(t, 200*time.Millisecond, opts.WriteTimeout)
	// We pass -1 ("no retries"); go-redis normalizes it to 0. Passing 0 would mean 3.
	assert.Equal(t, 0, opts.MaxRetries, "no command retries")
	assert.Equal(t, 1, opts.DialerRetries, "one connection attempt")
	assert.True(t, opts.ContextTimeoutEnabled)
}

func TestUnreachableRedisFailsWithinTheTimeout(t *testing.T) {
	// 10.255.255.1 is a non-routable address: connecting hangs until the timeout,
	// which is the slow kind of outage. With go-redis's defaults this call could
	// take many seconds.
	client := NewClient(Settings{Host: "10.255.255.1", Port: 6379, Timeout: 200 * time.Millisecond})
	defer client.Close()

	start := time.Now()
	err := client.Get(t.Context(), "key").Err()

	assert.Error(t, err)
	assert.Less(t, time.Since(start), time.Second)
}

func TestRequestDeadlineStopsWaiting(t *testing.T) {
	client := NewClient(Settings{Host: "10.255.255.1", Port: 6379, Timeout: 5 * time.Second})
	defer client.Close()

	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	err := client.Get(ctx, "key").Err()

	assert.Error(t, err)
	assert.Less(t, time.Since(start), time.Second, "the request's deadline wins over a longer timeout")
}

// TestClientAgainstRedis needs a real Redis; set REDIS_TEST_HOST to run it.
func TestClientAgainstRedis(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Skip("REDIS_TEST_HOST not set")
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

func TestRouteLogsSendsLibraryLogsToTheLogger(t *testing.T) {
	var buf bytes.Buffer
	RouteLogs(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { RouteLogs(slog.New(slog.DiscardHandler)) })

	// Force go-redis to log a dial failure.
	client := NewClient(settings())
	defer client.Close()
	_ = client.Ping(t.Context()).Err()

	var line map[string]any
	require.NoError(t, json.Unmarshal(bytes.SplitN(buf.Bytes(), []byte("\n"), 2)[0], &line))
	assert.Equal(t, "WARN", line["level"])
	assert.Equal(t, "go-redis", line["component"])
	assert.Contains(t, line["msg"], "dial")
}
