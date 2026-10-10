// Package domain holds the identity module's types and rules, independent of
// HTTP, the database, and Kratos.
package domain

import (
	"net/url"
	"strings"
	"time"
)

// User is our record of a person who can sign in (C94).
type User struct {
	ID               string // our ID (UUIDv7)
	KratosIdentityID string // the Kratos account it maps to (a token's sub)
	Email            string // the account's registration email
	Phone            string // the account's phone; unverified for now (C85)
	DisplayName      string // optional
	AvatarURL        string // optional: the address of the person's picture
}

// Account is what Kratos holds about an account, as the module needs it.
type Account struct {
	KratosIdentityID string
	Email            string
	Phone            string
	DisplayName      string
	AvatarURL        string // the picture trait
	Active           bool   // false once the account is disabled (C101)
}

// NewAccount is an account to create in Kratos: verified email, contact phone,
// and optionally a password and a Google sign-in (the provider's subject).
type NewAccount struct {
	Email         string
	Phone         string
	DisplayName   string
	Password      string // empty: no password sign-in
	GoogleSubject string // empty: no Google sign-in
}

// Recovery is a one-time way into an account without its password (C135): the
// person opens Link and enters Code to set a password. Both are secrets: shown
// only to whoever needs them, never logged.
type Recovery struct {
	Link      string
	Code      string
	ExpiresAt time.Time
}

// ValidAvatarURL reports whether s can be stored as a user's avatar_url: empty
// (no picture), or an absolute http:// or https:// address with a host (the
// users table's check matches the lowercase scheme only).
func ValidAvatarURL(s string) bool {
	if s == "" {
		return true
	}
	u, err := url.Parse(s)
	scheme := strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
	return err == nil && scheme && u.Host != ""
}

// Portrait is one of the built-in pictures a person may choose (C196): its ID is
// what clients send, File its name where the portraits are served.
type Portrait struct {
	ID   string
	File string
}

// Portraits are the pictures a person may choose until uploads have somewhere
// to live (C196).
var Portraits = []Portrait{
	{ID: "portrait-1", File: "portrait-1.jpg"},
	{ID: "portrait-2", File: "portrait-2.jpg"},
	{ID: "portrait-3", File: "portrait-3.jpg"},
	{ID: "portrait-4", File: "portrait-4.webp"},
	{ID: "portrait-5", File: "portrait-5.jpg"},
	{ID: "portrait-6", File: "portrait-6.jpg"},
	{ID: "portrait-7", File: "portrait-7.jpg"},
}

// PortraitURL is the address of the portrait id under baseURL (where the
// portraits are served), or false for an unknown id or no baseURL.
func PortraitURL(baseURL, id string) (string, bool) {
	if baseURL == "" {
		return "", false
	}
	for _, p := range Portraits {
		if p.ID == id {
			u, err := url.JoinPath(baseURL, p.File)
			return u, err == nil && ValidAvatarURL(u)
		}
	}
	return "", false
}
