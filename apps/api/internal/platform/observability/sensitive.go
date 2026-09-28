package observability

import "strings"

// This file holds the redaction policy: which attribute and group names are
// sensitive. Adding a word is a reviewed code change, not a runtime setting,
// so a deployment cannot switch redaction off (C29).

// sensitiveWords mark a name as sensitive when the normalized name contains any
// of them.
var sensitiveWords = []string{
	"password", "passwd", "secret", "token", "credential", "authorization",
	"bearer", "jwt", "cookie", "session", "dsn", "apikey", "privatekey",
	"accesskey", "signingkey", "encryptionkey",
}

// normalizer removes the separators ignored by matching.
var normalizer = strings.NewReplacer("_", "", "-", "")

// sensitive reports whether name matches the policy, ignoring case,
// underscores, and hyphens: "DB_DSN", "api-key", and "callbackURL" all match.
// Names ending in "url" are sensitive because URLs can embed credentials.
func sensitive(name string) bool {
	n := normalizer.Replace(strings.ToLower(name))
	if strings.HasSuffix(n, "url") {
		return true
	}
	for _, word := range sensitiveWords {
		if strings.Contains(n, word) {
			return true
		}
	}
	return false
}
