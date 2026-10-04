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
