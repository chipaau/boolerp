// Package kratos reads accounts from Kratos's admin API (internal network only)
// with Ory's SDK, github.com/ory/client-go (C94).
package kratos

import (
	"context"
	"errors"
	"net/http"

	ory "github.com/ory/client-go"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/application"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
)

// Accounts implements application.Accounts.
type Accounts struct {
	api *ory.APIClient
}

// NewAccounts returns accounts read from Kratos's admin API at adminURL (such as
// http://kratos:4434), with client.
func NewAccounts(adminURL string, client *http.Client) *Accounts {
	cfg := ory.NewConfiguration()
	cfg.Servers = ory.ServerConfigurations{{URL: adminURL}}
	cfg.HTTPClient = client
	return &Accounts{api: ory.NewAPIClient(cfg)}
}

// Get implements application.Accounts.
func (a *Accounts) Get(ctx context.Context, kratosIdentityID string) (domain.Account, error) {
	identity, resp, err := a.api.IdentityAPI.GetIdentity(ctx, kratosIdentityID).Execute()
	if resp != nil {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return domain.Account{}, application.ErrNotFound
		}
	}
	if err != nil {
		// The SDK's error can carry the response body; report only that it failed.
		return domain.Account{}, errors.New("kratos: reading the account failed")
	}
	traits, _ := identity.Traits.(map[string]any)
	return domain.Account{
		KratosIdentityID: identity.Id,
		Email:            text(traits["email"]),
		Phone:            text(traits["phone"]),
		DisplayName:      text(traits["name"]),
	}, nil
}

func text(v any) string {
	s, _ := v.(string)
	return s
}
