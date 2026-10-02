//go:build feature

package bootstrap

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// freePort returns a TCP port nothing is listening on.
func freePort(t *testing.T) int {
	t.Helper()
	ln, err := new(net.ListenConfig).Listen(t.Context(), "tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := ln.Addr().(*net.TCPAddr).Port
	require.NoError(t, ln.Close())
	return port
}

// secretFile writes content to a file, as a mounted secret.
func secretFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "secret")
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	return path
}

func redisHost(t *testing.T) string {
	t.Helper()
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Fatal("REDIS_TEST_HOST is not set; feature tests need Redis (see docs/testing.md)")
	}
	return host
}

// serve runs run in the background and returns a function that cancels it and
// returns its error.
func serve(t *testing.T, run func(ctx context.Context) error) (stop func() error) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- run(ctx) }()
	return func() error {
		cancel()
		select {
		case err := <-done:
			return err
		case <-time.After(15 * time.Second):
			t.Fatal("the server did not shut down")
			return nil
		}
	}
}

// waitFor polls url until it answers want, failing after a few seconds.
func waitFor(t *testing.T, url string, want int) {
	t.Helper()
	require.Eventually(t, func() bool {
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, url, nil)
		if err != nil {
			return false
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return false
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		return resp.StatusCode == want
	}, 10*time.Second, 50*time.Millisecond, "%s never answered %d", url, want)
}

func TestFeatureRunServesUntilCancelled(t *testing.T) {
	db := testdb.Settings(t, testdb.RuntimeRole)
	port := freePort(t)
	cfg, err := config.Load([]string{
		"APP_ENV=test", "APP_PORT=" + strconv.Itoa(port), "APP_SHUTDOWN_TIMEOUT=30s",
		"APP_DB_HOST=" + db.Host, "APP_DB_PORT=" + strconv.Itoa(db.Port), "APP_DB_NAME=" + db.Name,
		"APP_DB_USER=" + db.User, "APP_DB_PASSWORD_FILE=" + secretFile(t, db.Password), "APP_DB_SSLMODE=disable",
		"APP_REDIS_HOST=" + redisHost(t), "APP_REDIS_TLS=false",
		"APP_AUTH_ISSUER=http://127.0.0.1:1/",
		"APP_IDENTITY_KRATOS_ADMIN_URL=http://127.0.0.1:1", "APP_IDENTITY_HYDRA_ADMIN_URL=http://127.0.0.1:1",
	})
	require.NoError(t, err)

	var registered bool
	register := func(_ context.Context, r chi.Router, d Deps) {
		registered = d.Pool != nil && d.Cache != nil && d.HTTPClient != nil
		r.Get("/api/test", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	}
	stop := serve(t, func(ctx context.Context) error {
		return Run(ctx, cfg, slog.New(slog.DiscardHandler), register)
	})

	base := "http://127.0.0.1:" + strconv.Itoa(port)
	waitFor(t, base+"/api/healthz", http.StatusOK)
	waitFor(t, base+"/api/readyz", http.StatusOK)
	waitFor(t, base+"/api/test", http.StatusNoContent)
	assert.True(t, registered, "the modules get the pool, cache, and HTTP client")

	assert.NoError(t, stop(), "cancelling shuts the server down cleanly")
}

func TestFeatureRunFailsOnABusyPort(t *testing.T) {
	db := testdb.Settings(t, testdb.RuntimeRole)
	ln, err := new(net.ListenConfig).Listen(t.Context(), "tcp", ":0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = ln.Close() })
	cfg, err := config.Load([]string{
		"APP_ENV=test", "APP_PORT=" + strconv.Itoa(ln.Addr().(*net.TCPAddr).Port),
		"APP_DB_HOST=" + db.Host, "APP_DB_PORT=" + strconv.Itoa(db.Port), "APP_DB_NAME=" + db.Name,
		"APP_DB_USER=" + db.User, "APP_DB_PASSWORD_FILE=" + secretFile(t, db.Password), "APP_DB_SSLMODE=disable",
		"APP_REDIS_HOST=" + redisHost(t), "APP_REDIS_TLS=false",
		"APP_AUTH_ISSUER=http://127.0.0.1:1/",
		"APP_IDENTITY_KRATOS_ADMIN_URL=http://127.0.0.1:1", "APP_IDENTITY_HYDRA_ADMIN_URL=http://127.0.0.1:1",
	})
	require.NoError(t, err)

	err = Run(t.Context(), cfg, slog.New(slog.DiscardHandler), func(context.Context, chi.Router, Deps) {})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "listen")
}

func TestFeatureRunBFFServesUntilCancelled(t *testing.T) {
	// The API the BFF forwards to: it must never be reached without a session.
	api := http.NewServeMux()
	api.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		t.Error("the API must not be called without a session")
		w.WriteHeader(http.StatusTeapot)
	})
	apiSrv := &http.Server{Handler: api, ReadHeaderTimeout: time.Second}
	apiLn, err := new(net.ListenConfig).Listen(t.Context(), "tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = apiSrv.Serve(apiLn) }()
	t.Cleanup(func() { _ = apiSrv.Close() })

	port := freePort(t)
	cfg, err := config.LoadBFF([]string{
		"BFF_ENV=test", "BFF_PORT=" + strconv.Itoa(port), "BFF_SHUTDOWN_TIMEOUT=30s",
		"BFF_REDIS_HOST=" + redisHost(t), "BFF_REDIS_TLS=false",
		"BFF_SESSION_ENCRYPTION_KEY_FILE=" + secretFile(t, "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"),
		"BFF_SESSION_COOKIE_SECURE=false",
		"BFF_OIDC_ISSUER=http://127.0.0.1:1/", "BFF_OIDC_CLIENT_ID=erp-test",
		"BFF_OIDC_CLIENT_SECRET_FILE=" + secretFile(t, "s3cret"),
		"BFF_API_URL=http://" + apiLn.Addr().String(),
	})
	require.NoError(t, err)

	stop := serve(t, func(ctx context.Context) error {
		return RunBFF(ctx, cfg, slog.New(slog.DiscardHandler))
	})

	base := "http://127.0.0.1:" + strconv.Itoa(port)
	waitFor(t, base+"/healthz", http.StatusOK)
	waitFor(t, base+"/readyz", http.StatusOK)
	waitFor(t, base+"/api/auth/me", http.StatusUnauthorized) // no session: the BFF answers, not the API
	waitFor(t, base+"/", http.StatusOK)                      // the embedded app

	assert.NoError(t, stop(), "cancelling shuts the BFF down cleanly")
}
