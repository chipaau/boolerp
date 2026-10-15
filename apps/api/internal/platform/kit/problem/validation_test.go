package problem

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPointerEscapesSpecialCharacters(t *testing.T) {
	assert.Equal(t, "#/a~1b/c~0d", Pointer("a/b", "c~d"))
	assert.Equal(t, "#/items/0/name", Pointer("items", "0", "name"))
}

func TestFieldNamesABodyFieldByItsPath(t *testing.T) {
	assert.Equal(t, FieldError{Pointer: "#/institutionTypes/1/code", Code: "exists", Detail: "is not in use"},
		Field("institutionTypes/1/code", "exists", "is not in use"))
	assert.Equal(t, "#/a~0b", Field("a~b", "x", "y").Pointer)
}

func TestAValidationErrorCollectsFieldsAndIsNilWhenEmpty(t *testing.T) {
	var v ValidationError
	assert.NoError(t, v.Err(), "no errors: nil, so a check can return v.Err()")

	v.Add("country", "exists", "is not a country in use")
	v.Add("slug", "unique", "is already used by X")
	var got *ValidationError
	require.ErrorAs(t, v.Err(), &got)
	assert.Equal(t, []FieldError{
		{Pointer: "#/country", Code: "exists", Detail: "is not a country in use"},
		{Pointer: "#/slug", Code: "unique", Detail: "is already used by X"},
	}, got.Errors)
}

func TestInvalidIsOneFieldsError(t *testing.T) {
	var got *ValidationError
	require.True(t, errors.As(Invalid("parentId", "exists", "is not a parent"), &got))
	assert.Equal(t, []FieldError{{Pointer: "#/parentId", Code: "exists", Detail: "is not a parent"}}, got.Errors)
}
