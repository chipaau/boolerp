// Package postgres stores the identity module's users in PostgreSQL.
package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/application"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
)

// DB is what the queries need: a pool or a transaction (C79), so tests can run
// them inside a rolled-back transaction.
type DB interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Users implements application.Users.
type Users struct {
	db DB
}

// NewUsers returns the users store over db.
func NewUsers(db DB) *Users { return &Users{db: db} }

const columns = `id::text, kratos_identity_id::text, email, phone, coalesce(display_name, '')`

// ByKratosID implements application.Users.
func (s *Users) ByKratosID(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	u, err := scan(s.db.QueryRow(ctx,
		`SELECT `+columns+` FROM users WHERE kratos_identity_id = $1`, kratosIdentityID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrNotFound
	}
	return u, err
}

// Save implements application.Users: one statement, so two first requests for
// the same account at once cannot create two users.
func (s *Users) Save(ctx context.Context, a domain.Account) (domain.User, error) {
	return scan(s.db.QueryRow(ctx, `
		INSERT INTO users (kratos_identity_id, email, phone, display_name)
		VALUES ($1, $2, $3, nullif($4, ''))
		ON CONFLICT (kratos_identity_id) DO UPDATE
		SET email = excluded.email, phone = excluded.phone,
		    display_name = excluded.display_name, updated_at = now()
		RETURNING `+columns,
		a.KratosIdentityID, a.Email, a.Phone, a.DisplayName))
}

func scan(row pgx.Row) (domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.KratosIdentityID, &u.Email, &u.Phone, &u.DisplayName)
	return u, err
}
