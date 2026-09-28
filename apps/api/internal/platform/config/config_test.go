package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadDefaults(t *testing.T) {
	for name, environ := range map[string][]string{
		"unset": nil,
		"empty": {"APP_ENV=", "APP_PORT="},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := Load(environ)
			require.NoError(t, err)
			assert.Equal(t, Config{Environment: "dev", Port: 8080}, cfg)
		})
	}
}

func TestLoadValues(t *testing.T) {
	cfg, err := Load([]string{"APP_ENV=prod", "APP_PORT=9000"})
	require.NoError(t, err)
	assert.Equal(t, Config{Environment: "prod", Port: 9000}, cfg)
}

func TestLoadInvalid(t *testing.T) {
	tests := []struct {
		name     string
		environ  []string
		variable string // must appear in the error
		value    string // must not appear in the error
	}{
		{"port not a number", []string{"APP_PORT=s3cret"}, "APP_PORT", "s3cret"},
		{"port zero", []string{"APP_PORT=0"}, "APP_PORT", ""},
		{"port too large", []string{"APP_PORT=70000"}, "APP_PORT", "70000"},
		{"unknown environment", []string{"APP_ENV=s3cret"}, "APP_ENV", "s3cret"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Load(tt.environ)
			require.Error(t, err)
			assert.ErrorContains(t, err, tt.variable)
			if tt.value != "" {
				assert.NotContains(t, err.Error(), tt.value, "error discloses the value")
			}
		})
	}
}
