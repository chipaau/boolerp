// Package kratos reads and deactivates accounts with Kratos's admin API
// (internal network only) through Ory's SDK, github.com/ory/client-go (C94, C101).
package kratos

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"time"

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
		AvatarURL:        text(traits["picture"]),
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
	body.SetCredentials(signIn(n.Password, n.GoogleSubject))

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

// signIn is the credentials for a password and a Google subject (either empty).
func signIn(password, googleSubject string) ory.IdentityWithCredentials {
	credentials := ory.IdentityWithCredentials{}
	if password != "" {
		credentials.Password = &ory.IdentityWithCredentialsPassword{
			Config: &ory.IdentityWithCredentialsPasswordConfig{Password: &password},
		}
	}
	if googleSubject != "" {
		credentials.Oidc = &ory.IdentityWithCredentialsOidc{Config: &ory.IdentityWithCredentialsOidcConfig{
			Providers: []ory.IdentityWithCredentialsOidcConfigProvider{
				*ory.NewIdentityWithCredentialsOidcConfigProvider("google", googleSubject),
			},
		}}
	}
	return credentials
}

// AddSignIn implements application.Accounts: Kratos's update replaces the whole
// identity, so it sends the account's own schema, state, and traits back with the
// credentials. Kratos refuses a Google sign-in the account already has (409), so
// one already there is not sent again; the password is always set.
func (a *Accounts) AddSignIn(ctx context.Context, kratosIdentityID, password, googleSubject string) error {
	identity, resp, err := a.api.IdentityAPI.GetIdentity(ctx, kratosIdentityID).Execute()
	if resp != nil {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return application.ErrNotFound
		}
	}
	if err != nil {
		return errors.New("kratos: reading the account failed")
	}
	if hasGoogle(identity, googleSubject) {
		googleSubject = ""
	}
	traits, _ := identity.Traits.(map[string]any)
	body := ory.NewUpdateIdentityBody(identity.SchemaId, identity.GetState(), traits)
	body.SetCredentials(signIn(password, googleSubject))
	_, resp, err = a.api.IdentityAPI.UpdateIdentity(ctx, kratosIdentityID).UpdateIdentityBody(*body).Execute()
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		// The request carries the password; report only that it failed.
		return errors.New("kratos: adding the sign-in failed")
	}
	return nil
}

// hasGoogle reports whether the account already signs in with Google as subject
// (Kratos records it as the identifier "google:<subject>").
func hasGoogle(identity *ory.Identity, subject string) bool {
	if subject == "" {
		return false
	}
	oidc, ok := identity.GetCredentials()["oidc"]
	return ok && slices.Contains(oidc.Identifiers, "google:"+subject)
}

// Recover implements application.Accounts with Kratos's recovery code (the
// configured recovery method, C85): a link to the recovery page and the code
// to enter there.
func (a *Accounts) Recover(ctx context.Context, kratosIdentityID string, ttl time.Duration) (domain.Recovery, error) {
	body := ory.NewCreateRecoveryCodeForIdentityBody(kratosIdentityID)
	body.SetExpiresIn(ttl.String())
	r, resp, err := a.api.IdentityAPI.CreateRecoveryCodeForIdentity(ctx).
		CreateRecoveryCodeForIdentityBody(*body).Execute()
	if resp != nil {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return domain.Recovery{}, application.ErrNotFound
		}
	}
	if err != nil {
		return domain.Recovery{}, errors.New("kratos: creating the recovery code failed")
	}
	return domain.Recovery{Link: r.RecoveryLink, Code: r.RecoveryCode, ExpiresAt: r.GetExpiresAt()}, nil
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
