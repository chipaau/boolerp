package auth

import (
	"errors"
	"net/http"

	"github.com/go-chi/render"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// portraits lists the built-in pictures a person may choose (GET
// /api/auth/me/portraits, C196). Cerbos decides first: identity:user view of
// their own user.
func (m *Module) portraits(w http.ResponseWriter, r *http.Request) {
	caller, _ := FromContext(r.Context())
	if err := m.authz.Check(r.Context(), "view", ownUser(caller)); err != nil {
		authorization.WriteError(w, r, err)
		return
	}
	type portrait struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	body := struct {
		Portraits []portrait `json:"portraits"`
	}{Portraits: []portrait{}}
	for _, p := range m.users.Portraits() {
		body.Portraits = append(body.Portraits, portrait{ID: p.ID, URL: p.URL})
	}
	render.JSON(w, r, body)
}

// setPhoto changes the caller's picture (PUT /api/auth/me/photo, C196): one of
// the portraits by ID, or "" for their initials. Clients send an ID, never an
// address, so a picture is always one the platform serves. The picture is
// written to the person's Kratos account, so every app shows it. Cerbos decides
// first: identity:user update of their own user. It answers like GET /me.
func (m *Module) setPhoto(w http.ResponseWriter, r *http.Request) {
	caller, _ := FromContext(r.Context())
	if err := m.authz.Check(r.Context(), "update", ownUser(caller)); err != nil {
		authorization.WriteError(w, r, err)
		return
	}
	var in struct {
		Portrait *string `json:"portrait" validate:"required,max=64"`
	}
	if !httpinput.Decode(w, r, &in) {
		return
	}

	user, err := m.users.SetPortrait(r.Context(), caller.Token.Subject, *in.Portrait)
	switch {
	case err == nil:
	case errors.Is(err, identity.ErrUnknownPortrait):
		problem.WriteValidation(w, r, []problem.FieldError{
			{Pointer: "#/portrait", Code: "oneof", Detail: "must be one of the portraits, or empty for initials"},
		})
		return
	default:
		m.logger.ErrorContext(r.Context(), "changing the caller's picture failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Your photo could not be saved. Try again shortly.")
		return
	}
	caller.User = &user
	writeCaller(w, r, caller)
}
