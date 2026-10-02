// Package domain holds the identity module's types and rules, independent of
// HTTP, the database, and Kratos.
package domain

// User is our record of a person who can sign in (C94).
type User struct {
	ID               string // our ID (UUIDv7)
	KratosIdentityID string // the Kratos account it maps to (a token's sub)
	Email            string // the account's registration email
	Phone            string // the account's phone; unverified for now (C85)
	DisplayName      string // optional
}

// Account is what Kratos holds about an account, as the module needs it.
type Account struct {
	KratosIdentityID string
	Email            string
	Phone            string
	DisplayName      string
	Active           bool // false once the account is disabled (C101)
}
