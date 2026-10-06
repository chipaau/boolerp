//go:build feature

package store_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/application"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C77, C79): the users table in the migrated suite database, as
// the runtime role, inside a transaction rolled back after each test.

const kratosID = "38a62480-7b62-4d66-98ee-47fb6e5d8697"

func TestFeatureSaveCreatesThenUpdatesTheSameUser(t *testing.T) {
	users := store.NewUsers(testdb.Tx(t))
	ctx := t.Context()

	created, err := users.Save(ctx, domain.Account{KratosIdentityID: kratosID, Email: "a@b.test", Phone: "+9607770000"})
	require.NoError(t, err)
	assert.Len(t, created.ID, 36, "a UUID")
	assert.Empty(t, created.DisplayName)
	assert.Empty(t, created.AvatarURL)

	updated, err := users.Save(ctx, domain.Account{
		KratosIdentityID: kratosID, Email: "a@b.test", Phone: "+9607771111", DisplayName: "Aisha",
		AvatarURL: "https://example.test/aisha.png",
	})
	require.NoError(t, err)
	assert.Equal(t, created.ID, updated.ID, "one user per Kratos account")
	assert.Equal(t, "+9607771111", updated.Phone)
	assert.Equal(t, "https://example.test/aisha.png", updated.AvatarURL)

	found, err := users.ByKratosID(ctx, kratosID)
	require.NoError(t, err)
	assert.Equal(t, updated, found)
}

func TestFeatureUnknownAccountIsNotFound(t *testing.T) {
	_, err := store.NewUsers(testdb.Tx(t)).ByKratosID(t.Context(), "00000000-0000-0000-0000-000000000000")
	assert.ErrorIs(t, err, application.ErrNotFound)
}

func TestFeatureTheRuntimeRoleCannotDeleteUsers(t *testing.T) {
	tx := testdb.Tx(t)
	users := store.NewUsers(tx)
	_, err := users.Save(t.Context(), domain.Account{
		KratosIdentityID: "00000000-0000-0000-0000-0000000000d1", Email: "d@b.test", Phone: "+9607000000",
	})
	require.NoError(t, err)

	tag, err := tx.Exec(t.Context(), `DELETE FROM users WHERE kratos_identity_id = '00000000-0000-0000-0000-0000000000d1'`)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no delete policy: the row is not deleted")
	_, err = users.ByKratosID(t.Context(), "00000000-0000-0000-0000-0000000000d1")
	assert.NoError(t, err, "the user is still there")
}

func TestFeatureAvatarURLMustBeAnHTTPAddress(t *testing.T) {
	for _, avatar := range []string{"javascript:alert(1)", "ftp://example.test/a.png", "data:image/png;base64,AA"} {
		t.Run(avatar, func(t *testing.T) {
			_, err := store.NewUsers(testdb.Tx(t)).Save(t.Context(), domain.Account{
				KratosIdentityID: "00000000-0000-0000-0000-0000000000a1", Email: "v@b.test", Phone: "+9607000000",
				AvatarURL: avatar,
			})
			assert.Error(t, err, "the check constraint refuses it")
		})
	}
}

func TestFeatureSaveIsAttributedInTheAudit(t *testing.T) {
	tx := testdb.Tx(t)
	ctx := actor.With(t.Context(), actor.Actor{Operation: "POST /api/auth/me", ClientID: "bff-workspace"})
	_, err := store.NewUsers(tx).Save(ctx, domain.Account{
		KratosIdentityID: "00000000-0000-0000-0000-0000000000e1", Email: "e@b.test", Phone: "+9607000000",
	})
	require.NoError(t, err)
	// Save's transaction is a savepoint of the test's: its local settings remain.
	var op string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT current_setting('app.operation')`).Scan(&op))
	assert.Equal(t, "POST /api/auth/me", op)
}
