// Package kratos reads and deactivates accounts with Kratos's admin API
// (internal network only) through Ory's SDK, github.com/ory/client-go (C94, C101).
package kratos

import (
	"context"
	"errors"
	"net/http"

	ory "github.com/ory/client-go"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/application"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
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
	return account(identity), nil
}

// account maps a Kratos identity to the module's Account.
func account(identity *ory.Identity) domain.Account {
	traits, _ := identity.Traits.(map[string]any)
	return domain.Account{
		KratosIdentityID: identity.Id,
		Email:            text(traits["email"]),
		Phone:            text(traits["phone"]),
		DisplayName:      text(traits["name"]),
		Active:           identity.GetState() == "active",
	}
}

// FindByEmail implements application.Accounts: the identity whose credentials
// identifier (its login email) is email.
func (a *Accounts) FindByEmail(ctx context.Context, email string) (domain.Account, error) {
	identities, resp, err := a.api.IdentityAPI.ListIdentities(ctx).CredentialsIdentifier(email).Execute()
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		return domain.Account{}, errors.New("kratos: looking up the account failed")
	}
	if len(identities) == 0 {
		return domain.Account{}, application.ErrNotFound
	}
	return account(&identities[0]), nil
}

// Create implements application.Accounts: an active identity with the
// registration schema, its email verified, and the password and Google
// sign-in it is given.
func (a *Accounts) Create(ctx context.Context, n domain.NewAccount) (domain.Account, error) {
	traits := map[string]any{"email": n.Email, "phone": n.Phone}
	if n.DisplayName != "" {
		traits["name"] = n.DisplayName
	}
	body := ory.NewCreateIdentityBody("registration", traits)
	body.SetState("active")
	body.SetVerifiableAddresses([]ory.VerifiableIdentityAddress{
		*ory.NewVerifiableIdentityAddress("completed", n.Email, true, "email"),
	})
	credentials := ory.IdentityWithCredentials{}
	if n.Password != "" {
		credentials.Password = &ory.IdentityWithCredentialsPassword{
			Config: &ory.IdentityWithCredentialsPasswordConfig{Password: &n.Password},
		}
	}
	if n.GoogleSubject != "" {
		credentials.Oidc = &ory.IdentityWithCredentialsOidc{Config: &ory.IdentityWithCredentialsOidcConfig{
			Providers: []ory.IdentityWithCredentialsOidcConfigProvider{
				*ory.NewIdentityWithCredentialsOidcConfigProvider("google", n.GoogleSubject),
			},
		}}
	}
	body.SetCredentials(credentials)

	identity, resp, err := a.api.IdentityAPI.CreateIdentity(ctx).CreateIdentityBody(*body).Execute()
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		// The SDK's error can carry the request or response body (with the
		// password); report only that it failed.
		return domain.Account{}, errors.New("kratos: creating the account failed")
	}
	return account(identity), nil
}

// Deactivate implements application.Accounts: the identity's state becomes
// inactive, which Kratos refuses at login, and its sessions are deleted.
func (a *Accounts) Deactivate(ctx context.Context, kratosIdentityID string) error {
	_, resp, err := a.api.IdentityAPI.PatchIdentity(ctx, kratosIdentityID).
		JsonPatch([]ory.JsonPatch{{Op: "replace", Path: "/state", Value: "inactive"}}).Execute()
	if resp != nil {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return application.ErrNotFound
		}
	}
	if err != nil {
		return errors.New("kratos: deactivating the account failed")
	}
	resp, err = a.api.IdentityAPI.DeleteIdentitySessions(ctx, kratosIdentityID).Execute()
	if resp != nil {
		_ = resp.Body.Close()
		// Kratos answers 404 when the identity has no sessions to delete.
		if resp.StatusCode == http.StatusNotFound {
			return nil
		}
	}
	if err != nil {
		return errors.New("kratos: deleting the account's sessions failed")
	}
	return nil
}

func text(v any) string {
	s, _ := v.(string)
	return s
}
