package observability

import (
	"regexp"
	"slices"
	"strings"
)

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

// sensitiveQueryParams are query parameters whose values are credentials even
// though their names are not sensitive words: OAuth2's authorization code and
// state (C91).
var sensitiveQueryParams = []string{"code", "state"}

// queryParam matches one query parameter in a URL or a log message.
var queryParam = regexp.MustCompile(`([?&])([^=&#\s"]+)=([^&#\s"]*)`)

// scrubQuery redacts the values of sensitive query parameters in s, keeping
// their names: "/api/auth/callback?code=x&state=y" becomes
// "/api/auth/callback?code=[REDACTED]&state=[REDACTED]".
func scrubQuery(s string) string {
	if !strings.ContainsAny(s, "?&") {
		return s
	}
	return queryParam.ReplaceAllStringFunc(s, func(m string) string {
		parts := queryParam.FindStringSubmatch(m)
		name := strings.ToLower(parts[2])
		if sensitive(name) || slices.Contains(sensitiveQueryParams, name) {
			return parts[1] + parts[2] + "=" + Redacted
		}
		return m
	})
}
