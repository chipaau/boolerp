package auth

import (
	"errors"
	"net/http"
	"sync"
	"time"
)

// KeyFetchInterval is the least time between two downloads of the issuer's keys.
const KeyFetchInterval = 10 * time.Second

// errKeyFetchLimited is returned for a key download refused by KeyClient.
var errKeyFetchLimited = errors.New("auth: keys were fetched less than KeyFetchInterval ago")

// KeyClient returns a client for downloading the issuer's signing keys (a go-oidc
// RemoteKeySet): client's transport, allowing at most one request per
// KeyFetchInterval and refusing the others at once.
//
// go-oidc downloads the keys again whenever a token names an unknown key or its
// signature does not verify, so that it notices Hydra rotating its keys. It
// merges concurrent downloads but does not limit them, so a stream of forged
// tokens would mean a stream of downloads from Hydra. Limited, a forged token is
// refused without one; a real token signed with a new key waits at most
// KeyFetchInterval for the download that finds it. Tokens signed with known keys
// never download.
func KeyClient(client *http.Client) *http.Client {
	next := client.Transport
	if next == nil {
		next = http.DefaultTransport
	}
	limited := *client
	limited.Transport = &fetchLimit{next: next, every: KeyFetchInterval}
	return &limited
}

// fetchLimit is a transport passing at most one request per interval.
type fetchLimit struct {
	next  http.RoundTripper
	every time.Duration

	mu   sync.Mutex
	last time.Time
}

func (t *fetchLimit) RoundTrip(r *http.Request) (*http.Response, error) {
	t.mu.Lock()
	now := time.Now()
	if !t.last.IsZero() && now.Sub(t.last) < t.every {
		t.mu.Unlock()
		return nil, errKeyFetchLimited
	}
	t.last = now
	t.mu.Unlock()
	return t.next.RoundTrip(r)
}
