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
	// take to finish after SIGINT/SIGTERM before connections are closed.
	ShutdownTimeout time.Duration `env:"APP_SHUTDOWN_TIMEOUT" envDefault:"10s" validate:"gt=0,max=5m"`
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

// rule formats a failed validation rule, such as "max=65535".
func rule(fe validator.FieldError) string {
	if fe.Param() == "" {
		return fe.Tag()
	}
	return fe.Tag() + "=" + fe.Param()
}
