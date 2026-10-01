// Package http is the identity module's HTTP adapter: the Kratos web hook on the
// internal listener (C94).
package http

import (
	"context"
	"crypto/subtle"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/application"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
	"github.com/boolmv/erp/apps/api/internal/platform/httpinput"
	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

// WebhookKeyHeader carries the shared secret Kratos sends with each web hook.
const WebhookKeyHeader = "X-Webhook-Key"

// Syncer copies a Kratos account into its user (application.Service.Sync).
type Syncer interface {
	Sync(ctx context.Context, kratosIdentityID string) (domain.User, error)
}

// Hooks serves Kratos's web hooks.
type Hooks struct {
	users  Syncer
	key    []byte // the shared secret; a secret, never logged
	logger *slog.Logger
}

// NewHooks returns the web hook handlers.
func NewHooks(users Syncer, key string, logger *slog.Logger) *Hooks {
	return &Hooks{users: users, key: []byte(key), logger: logger}
}

// Routes registers the hooks, relative to where they are mounted on the internal
// listener.
func (h *Hooks) Routes(r chi.Router) {
	r.Post("/kratos", h.kratos)
}

// kratosHook is what Kratos sends (docker/kratos, a jsonnet body): only the
// account ID. The account itself is read from Kratos's admin API, so nothing in
// the request body is trusted.
type kratosHook struct {
	IdentityID string `json:"identity_id" validate:"required,uuid"`
}

// kratos copies the account into its user after registration.
func (h *Hooks) kratos(w http.ResponseWriter, r *http.Request) {
	if subtle.ConstantTimeCompare([]byte(r.Header.Get(WebhookKeyHeader)), h.key) != 1 {
		problem.Error(w, r, http.StatusUnauthorized, "")
		return
	}
	var body kratosHook
	if !httpinput.Decode(w, r, &body) {
		return
	}
	if _, err := h.users.Sync(r.Context(), body.IdentityID); err != nil {
		if errors.Is(err, application.ErrNotFound) {
			problem.Error(w, r, http.StatusNotFound, "No such account.")
			return
		}
		h.logger.ErrorContext(r.Context(), "syncing a user from Kratos failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
