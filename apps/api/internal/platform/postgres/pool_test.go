package postgres

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

// settings returns valid settings for a server that is not running.
func settings() Settings {
	return Settings{
		Host: "127.0.0.1", Port: 1, Name: "erp", User: "app",
		Password: "s3cret", SSLMode: "disable", MaxConns: 5,
	}
}

func TestNewPoolAppliesSettings(t *testing.T) {
	s := settings()
	s.Password = "p@ss/w:rd?#%" // characters that must be URL-escaped
	s.Name = "erp db"
	pool, err := NewPool(t.Context(), s)
	require.NoError(t, err)
	defer pool.Close()

	cc := pool.Config().ConnConfig
	assert.Equal(t, "127.0.0.1", cc.Host)
	assert.EqualValues(t, 1, cc.Port)
	assert.Equal(t, "erp db", cc.Database)
	assert.Equal(t, "app", cc.User)
	assert.Equal(t, "p@ss/w:rd?#%", cc.Password, "the password arrives unchanged")
	assert.EqualValues(t, 5, pool.Config().MaxConns)
}

func TestNewPoolSSLMode(t *testing.T) {
	for mode, wantTLS := range map[string]bool{"disable": false, "require": true, "verify-full": true} {
		s := settings()
		s.SSLMode = mode
		pool, err := NewPool(t.Context(), s)
		require.NoError(t, err, mode)
		cc := pool.Config().ConnConfig
		assert.Equal(t, wantTLS, cc.TLSConfig != nil, mode)
		assert.Empty(t, cc.Fallbacks, "%s: no silent fallback to an unencrypted connection", mode)
		pool.Close()
	}
}

func TestNewPoolRejectsInvalidSettingsWithoutEchoingThem(t *testing.T) {
	s := settings()
	s.SSLMode = "s3cret-mode" // unreachable after config validation, but must still be safe
	_, err := NewPool(t.Context(), s)

	require.ErrorIs(t, err, ErrInvalidSettings)
	assert.NotContains(t, err.Error(), "s3cret")
}

func TestNewPoolDoesNotConnect(t *testing.T) {
	// Nothing listens on port 1. Creating the pool must still succeed at once,
	// so the API can start while PostgreSQL is down.
	start := time.Now()
	pool, err := NewPool(t.Context(), settings())
	require.NoError(t, err)
	defer pool.Close()

	assert.Less(t, time.Since(start), time.Second)
	assert.Zero(t, pool.Stat().TotalConns(), "no connection opened yet")

	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	assert.Error(t, pool.Ping(ctx), "using it fails while the database is unreachable")
}

// TestPoolConnects needs a real PostgreSQL. Set POSTGRES_TEST_HOST (and
// optionally _PORT, _DB, _USER, _PASSWORD) to run it.
func TestPoolConnects(t *testing.T) {
	host := os.Getenv("POSTGRES_TEST_HOST")
	if host == "" {
		t.Skip("POSTGRES_TEST_HOST not set")
	}
	port, _ := strconv.Atoi(cmp.Or(os.Getenv("POSTGRES_TEST_PORT"), "5432"))
	pool, err := NewPool(t.Context(), Settings{
		Host:     host,
		Port:     port,
		Name:     cmp.Or(os.Getenv("POSTGRES_TEST_DB"), "postgres"),
		User:     cmp.Or(os.Getenv("POSTGRES_TEST_USER"), "postgres"),
		Password: os.Getenv("POSTGRES_TEST_PASSWORD"),
		SSLMode:  "disable",
		MaxConns: 2,
	})
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	require.NoError(t, pool.Ping(ctx))
	assert.EqualValues(t, 1, pool.Stat().TotalConns())

	pool.Close()
	assert.Zero(t, pool.Stat().TotalConns(), "Close releases every connection")
}
