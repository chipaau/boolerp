// Package hydra ends a person's logins with Hydra's admin API (internal network
// only) through Ory's SDK, github.com/ory/client-go (C101).
package hydra

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"regexp"

	ory "github.com/ory/client-go"
)

// Logins implements application.Logins.
type Logins struct {
	api *ory.APIClient
}

// NewLogins returns logins at Hydra's admin API at adminURL (such as
// http://hydra:4445), with client.
func NewLogins(adminURL string, client *http.Client) *Logins {
	cfg := ory.NewConfiguration()
	cfg.Servers = ory.ServerConfigurations{{URL: adminURL}}
	cfg.HTTPClient = client
	return &Logins{api: ory.NewAPIClient(cfg)}
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

// nextPageToken reads the page_token of the rel="next" link Hydra sends for
// another page of results.
var nextPageToken = regexp.MustCompile(`[?&]page_token=([^&>]+)[^>]*>;\s*rel="next"`)

// loginSessions returns the distinct login session IDs of the subject's consent
// sessions, following Hydra's pages.
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
		m := nextPageToken.FindStringSubmatch(resp.Header.Get("Link"))
		if m == nil || len(sessions) == 0 {
			return sids, nil
		}
		next, err := url.QueryUnescape(m[1])
		if err != nil || next == token {
			return sids, nil
		}
		token = next
	}
}
