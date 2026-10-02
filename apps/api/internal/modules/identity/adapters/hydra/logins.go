// Package hydra ends a person's logins with Hydra's admin API (internal network
// only) through Ory's SDK, github.com/ory/client-go (C101).
package hydra

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"

	ory "github.com/ory/client-go"
	"github.com/peterhellberg/link"
)

// Logins implements application.Logins.
type Logins struct {
	api    *ory.APIClient
	logger *slog.Logger
}

// NewLogins returns logins at Hydra's admin API at adminURL (such as
// http://hydra:4445), with client.
func NewLogins(adminURL string, client *http.Client, logger *slog.Logger) *Logins {
	cfg := ory.NewConfiguration()
	cfg.Servers = ory.ServerConfigurations{{URL: adminURL}}
	cfg.HTTPClient = client
	return &Logins{api: ory.NewAPIClient(cfg), logger: logger}
}

// RevokeAll implements application.Logins (C101). Hydra announces a login
// session's end to its clients (back-channel logout) only when it is revoked by
// its ID, not by subject, so the subject's login sessions are found through its
// consent sessions and revoked one by one. Then everything left of the subject
// is revoked: its other login sessions, and all its consent sessions, which
// revokes its access and refresh tokens.
func (l *Logins) RevokeAll(ctx context.Context, subject string) error {
	sids, err := l.loginSessions(ctx, subject)
	if err != nil {
		return err
	}
	for _, sid := range sids {
		resp, err := l.api.OAuth2API.RevokeOAuth2LoginSessions(ctx).Sid(sid).Execute()
		if resp != nil {
			_ = resp.Body.Close()
		}
		if err != nil {
			// The SDK's error can carry the response body; report only that it failed.
			return errors.New("hydra: ending a login session failed")
		}
	}
	resp, err := l.api.OAuth2API.RevokeOAuth2LoginSessions(ctx).Subject(subject).Execute()
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		return errors.New("hydra: ending the login sessions failed")
	}
	resp, err = l.api.OAuth2API.RevokeOAuth2ConsentSessions(ctx).Subject(subject).All(true).Execute()
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		return errors.New("hydra: revoking the consent sessions failed")
	}
	return nil
}

// loginSessions returns the distinct login session IDs of the subject's consent
// sessions. Hydra has no way to list a subject's login sessions, but each
// consent session records the login it came from (one login usually has a
// consent per app). Hydra pages the list, naming the next page in a Link
// header (rel="next", RFC 8288), which github.com/peterhellberg/link parses.
// If a next page cannot be followed, the logins found so far are returned with
// a warning: the remaining ones still lose their tokens (RevokeAll's last step),
// so those browsers are signed out within the access-token lifetime instead of
// at once.
func (l *Logins) loginSessions(ctx context.Context, subject string) ([]string, error) {
	seen := map[string]bool{}
	var sids []string
	token := ""
	for {
		req := l.api.OAuth2API.ListOAuth2ConsentSessions(ctx).Subject(subject).PageSize(500)
		if token != "" {
			req = req.PageToken(token)
		}
		sessions, resp, err := req.Execute()
		if resp != nil {
			_ = resp.Body.Close()
		}
		if err != nil {
			return nil, errors.New("hydra: listing the consent sessions failed")
		}
		for _, s := range sessions {
			if s.ConsentRequest == nil || s.ConsentRequest.LoginSessionId == nil {
				continue
			}
			if sid := *s.ConsentRequest.LoginSessionId; sid != "" && !seen[sid] {
				seen[sid] = true
				sids = append(sids, sid)
			}
		}
		next, ok := link.ParseResponse(resp)["next"]
		if !ok || len(sessions) == 0 {
			return sids, nil
		}
		u, err := url.Parse(next.URI)
		nextToken := ""
		if err == nil {
			nextToken = u.Query().Get("page_token")
		}
		if nextToken == "" || nextToken == token {
			l.logger.WarnContext(ctx, "hydra: the next page of consent sessions could not be followed; "+
				"the remaining logins end when their access tokens expire")
			return sids, nil
		}
		token = nextToken
	}
}
