package hydra

import (
	"context"
	"errors"
	"net/http"
	"strings"

	ory "github.com/ory/client-go"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/application"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
)

// Profiles implements application.Profiles with Hydra's public /userinfo, called
// with the person's own access token (C157). Ory's SDK is used instead of
// go-oidc's UserInfo, whose errors do not say whether Hydra refused the token
// (401) or failed.
type Profiles struct {
	api *ory.APIClient
}

// NewProfiles returns profiles read from Hydra's public API at publicURL (its
// issuer, such as http://identity.bool.test/), with client.
func NewProfiles(publicURL string, client *http.Client) *Profiles {
	cfg := ory.NewConfiguration()
	cfg.Servers = ory.ServerConfigurations{{URL: strings.TrimSuffix(publicURL, "/")}}
	cfg.HTTPClient = client
	return &Profiles{api: ory.NewAPIClient(cfg)}
}

// Account implements application.Profiles: the standard claims the consent
// granted (email, phone_number, name, picture) as an Account.
func (p *Profiles) Account(ctx context.Context, accessToken string) (domain.Account, error) {
	ctx = context.WithValue(ctx, ory.ContextAccessToken, accessToken)
	info, resp, err := p.api.OidcAPI.GetOidcUserInfo(ctx).Execute()
	if resp != nil {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusUnauthorized {
			return domain.Account{}, application.ErrTokenRefused
		}
	}
	if err != nil {
		// The SDK's error can carry the response body; report only that it failed.
		return domain.Account{}, errors.New("hydra: reading the profile failed")
	}
	return domain.Account{
		KratosIdentityID: info.GetSub(),
		Email:            info.GetEmail(),
		Phone:            info.GetPhoneNumber(),
		DisplayName:      info.GetName(),
		AvatarURL:        info.GetPicture(),
		// Hydra answers only for a token it still accepts; a disabled account's
		// tokens are revoked (C101).
		Active: true,
	}, nil
}
