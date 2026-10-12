package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidAvatarURL(t *testing.T) {
	for s, want := range map[string]bool{
		"":                                      true, // no picture
		"https://lh3.googleusercontent.com/a/x": true,
		"http://example.test/a.png":             true,
		"HTTPS://example.test/a.png":            false, // the table's check is lowercase
		"https://":                              false,
		"javascript:alert(1)":                   false,
		"data:image/png;base64,AA":              false,
		"ftp://example.test/a.png":              false,
		"//example.test/a.png":                  false,
		"https://exa mple.test/%zz":             false,
	} {
		assert.Equal(t, want, ValidAvatarURL(s), s)
	}
}

func TestPortraitURL(t *testing.T) {
	u, ok := PortraitURL("http://identity.bool.test/portraits/", "portrait-4")
	assert.True(t, ok)
	assert.Equal(t, "http://identity.bool.test/portraits/portrait-4.webp", u)

	u, ok = PortraitURL("http://identity.bool.test/portraits", "portrait-1")
	assert.True(t, ok, "a base without the trailing slash")
	assert.Equal(t, "http://identity.bool.test/portraits/portrait-1.jpg", u)

	for _, c := range []struct{ base, id string }{
		{"http://identity.bool.test/portraits/", "portrait-99"},
		{"http://identity.bool.test/portraits/", "https://evil.test/x.png"},
		{"http://identity.bool.test/portraits/", ""},
		{"", "portrait-1"},
		{"ftp://identity.bool.test/portraits/", "portrait-1"},
	} {
		_, ok := PortraitURL(c.base, c.id)
		assert.False(t, ok, c)
	}
}
