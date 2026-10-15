package tenancy

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// A unique violation that slipped past the check before the insert (two requests at once)
// becomes the field's error; any other error passes through.
func TestUniqueViolationNamesTheField(t *testing.T) {
	for constraint, pointer := range map[string]string{
		"tenants_slug_key": "#/slug", "tenants_code_key": "#/code",
		"tenants_identity_number": "#/identityNumber", "tenants_tax_number": "#/taxNumber",
	} {
		var invalid *problem.ValidationError
		require.ErrorAs(t, uniqueViolation(&pgconn.PgError{Code: "23505", ConstraintName: constraint}), &invalid, constraint)
		assert.Equal(t, []problem.FieldError{{Pointer: pointer, Code: "unique", Detail: "is already used by another tenant"}}, invalid.Errors)
	}
	other := &pgconn.PgError{Code: "23505", ConstraintName: "tenants_one_operator"}
	assert.Same(t, error(other), uniqueViolation(other), "a unique index with no field")
	check := &pgconn.PgError{Code: "23514"}
	assert.Same(t, error(check), uniqueViolation(check))
	plain := errors.New("down")
	assert.Same(t, plain, uniqueViolation(plain))
}
