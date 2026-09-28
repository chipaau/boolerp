// Package config loads and validates runtime settings from the process environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/go-playground/validator/v10"
)

// Config holds the runtime settings. Each field names its environment variable
// (env), its default when unset or empty (envDefault), and its rules (validate).
type Config struct {
	Environment string `env:"APP_ENV" envDefault:"dev" validate:"oneof=dev test staging prod"`
	Port        int    `env:"APP_PORT" envDefault:"8080" validate:"min=1,max=65535"`
	LogFormat   string `env:"APP_LOG_FORMAT" envDefault:"json" validate:"oneof=json text"`
	// slog.Level parses itself (it implements encoding.TextUnmarshaler), and
	// caarlos0/env uses that: "debug", "INFO", "warn", "error", or offsets like "info+2".
	LogLevel slog.Level `env:"APP_LOG_LEVEL" envDefault:"info"`
	// ShutdownTimeout bounds graceful shutdown: how long in-flight requests may
	// take to finish after SIGINT/SIGTERM before connections are closed. It must
	// be at least the write timeout, so any request the server allows can finish (C30).
	ShutdownTimeout time.Duration `env:"APP_SHUTDOWN_TIMEOUT" envDefault:"35s" validate:"gt=0,max=10m,gtefield=HTTPWriteTimeout"`

	// HTTP server limits. Headers must arrive within the full read timeout, and the
	// write timeout must exceed the read timeout to leave room for an error response.
	HTTPMaxBodyBytes      int64         `env:"APP_HTTP_MAX_BODY_BYTES" envDefault:"1048576" validate:"min=1,max=104857600"`
	HTTPReadHeaderTimeout time.Duration `env:"APP_HTTP_READ_HEADER_TIMEOUT" envDefault:"5s" validate:"gt=0,max=1m,ltefield=HTTPReadTimeout"`
	HTTPReadTimeout       time.Duration `env:"APP_HTTP_READ_TIMEOUT" envDefault:"15s" validate:"gt=0,max=5m"`
	HTTPWriteTimeout      time.Duration `env:"APP_HTTP_WRITE_TIMEOUT" envDefault:"30s" validate:"gt=0,max=10m,gtfield=HTTPReadTimeout"`
	HTTPIdleTimeout       time.Duration `env:"APP_HTTP_IDLE_TIMEOUT" envDefault:"60s" validate:"gt=0,max=10m"`
}

// Load reads settings from environ, which uses the os.Environ "KEY=value" form.
// Errors name the variable but never include its value.
func Load(environ []string) (Config, error) {
	cfg, err := env.ParseAsWithOptions[Config](env.Options{Environment: env.ToMap(environ)})
	if err != nil {
		return Config{}, redactParseErrors(err)
	}

	validate := validator.New(validator.WithRequiredStructEnabled())
	// Report the environment variable name instead of the Go field name.
	validate.RegisterTagNameFunc(envName)

	if err := validate.Struct(cfg); err != nil {
		var fieldErrs validator.ValidationErrors
		if !errors.As(err, &fieldErrs) {
			return Config{}, err
		}
		msgs := make([]string, 0, len(fieldErrs))
		for _, fe := range fieldErrs {
			// FieldError.Value() holds the rejected value; it is deliberately not used.
			msgs = append(msgs, fmt.Sprintf("%s: must satisfy %s", fe.Field(), rule(fe)))
		}
		return Config{}, fmt.Errorf("invalid configuration: %s", strings.Join(msgs, "; "))
	}

	return cfg, nil
}

// redactParseErrors replaces env.ParseError messages, which embed the rejected
// value (for example `parsing "abc"`), with the variable name and expected type.
// This is the documented gap in caarlos0/env; other env errors contain only names.
func redactParseErrors(err error) error {
	var agg env.AggregateError
	if !errors.As(err, &agg) {
		return err
	}
	msgs := make([]string, 0, len(agg.Errors))
	for _, e := range agg.Errors {
		var pe env.ParseError
		if errors.As(e, &pe) {
			field, _ := reflect.TypeFor[Config]().FieldByName(pe.Name)
			msgs = append(msgs, fmt.Sprintf("%s: invalid %s", envName(field), pe.Type))
			continue
		}
		msgs = append(msgs, e.Error())
	}
	return fmt.Errorf("invalid configuration: %s", strings.Join(msgs, "; "))
}

// envName returns the variable name from a field's env tag, such as "APP_PORT".
func envName(field reflect.StructField) string {
	name, _, _ := strings.Cut(field.Tag.Get("env"), ",")
	return name
}

// rule formats a failed validation rule, such as "max=65535". Cross-field rules
// (gtfield, ltefield, ...) name another Go field; report its variable instead.
func rule(fe validator.FieldError) string {
	param := fe.Param()
	if param == "" {
		return fe.Tag()
	}
	if strings.HasSuffix(fe.Tag(), "field") {
		if field, ok := reflect.TypeFor[Config]().FieldByName(param); ok {
			param = envName(field)
		}
	}
	return fe.Tag() + "=" + param
}
