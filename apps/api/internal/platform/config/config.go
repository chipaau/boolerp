// Package config loads and validates runtime settings from the process environment.
//
// Settings are grouped by concern, one file per group: app.go (APP_*), log.go
// (APP_LOG_*), http.go (APP_HTTP_*), and database.go (APP_DB_*). Each group is a
// struct whose env tags are joined to its envPrefix, so DB.Host reads APP_DB_HOST.
package config

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/caarlos0/env/v11"
	"github.com/go-playground/validator/v10"
)

// Config holds every runtime setting. Each field names its environment variable
// (env, joined to the group's envPrefix), its default when unset or empty
// (envDefault), and its rules (validate).
type Config struct {
	App  App  `envPrefix:"APP_"`
	Log  Log  `envPrefix:"APP_LOG_"`
	HTTP HTTP `envPrefix:"APP_HTTP_"`
	DB   DB   `envPrefix:"APP_DB_"`
}

// Load reads settings from environ, which uses the os.Environ "KEY=value" form.
// Errors name the variable but never include its value.
func Load(environ []string) (Config, error) {
	cfg, err := env.ParseAsWithOptions[Config](env.Options{Environment: env.ToMap(environ)})
	if err != nil {
		return Config{}, redactParseErrors(err)
	}

	validate := validator.New(validator.WithRequiredStructEnabled())
	// "origin" accepts exactly what net/http's CrossOriginProtection accepts as a
	// trusted origin, so the router cannot fail on a value that passed here.
	// Wildcards are rejected: go-chi/cors would treat them as "allow all".
	if err := validate.RegisterValidation("origin", func(fl validator.FieldLevel) bool {
		origin := fl.Field().String()
		return !strings.Contains(origin, "*") &&
			http.NewCrossOriginProtection().AddTrustedOrigin(origin) == nil
	}); err != nil {
		return Config{}, err
	}
	// Rules that compare settings in different groups. Validator's cross-struct
	// tags only reach structs nested inside the tagged one, not sibling groups.
	validate.RegisterStructValidation(validateAcrossGroups, Config{})

	if err := validate.Struct(cfg); err != nil {
		var fieldErrs validator.ValidationErrors
		if !errors.As(err, &fieldErrs) {
			return Config{}, err
		}
		msgs := make([]string, 0, len(fieldErrs))
		for _, fe := range fieldErrs {
			// FieldError.Value() holds the rejected value; it is deliberately not used.
			msgs = append(msgs, fmt.Sprintf("%s: must satisfy %s", variable(fe), rule(fe)))
		}
		return Config{}, fmt.Errorf("invalid configuration: %s", strings.Join(msgs, "; "))
	}

	return cfg, nil
}

// validateAcrossGroups checks rules that span groups. Errors are reported with
// the field's path, so they are named like any other validation error.
func validateAcrossGroups(sl validator.StructLevel) {
	cfg := sl.Current().Interface().(Config)
	// Graceful shutdown must let any request the server allows finish (C30).
	if cfg.App.ShutdownTimeout < cfg.HTTP.WriteTimeout {
		sl.ReportError(cfg.App.ShutdownTimeout, "ShutdownTimeout", "App.ShutdownTimeout", "gtefield", "HTTP.WriteTimeout")
	}
}

// variablesByPath maps each setting's Go field path ("DB.Port") to its
// environment variable ("APP_DB_PORT"); variablesByName maps its field name
// ("Port"). Field names are unique across groups (a test enforces this),
// because caarlos0/env's ParseError reports only the field name.
var variablesByPath, variablesByName = variables()

func variables() (byPath, byName map[string]string) {
	byPath, byName = map[string]string{}, map[string]string{}
	top := reflect.TypeFor[Config]()
	for i := range top.NumField() {
		group := top.Field(i)
		prefix := group.Tag.Get("envPrefix")
		for j := range group.Type.NumField() {
			f := group.Type.Field(j)
			name, _, _ := strings.Cut(f.Tag.Get("env"), ",")
			byPath[group.Name+"."+f.Name] = prefix + name
			byName[f.Name] = prefix + name
		}
	}
	return byPath, byName
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
			msgs = append(msgs, fmt.Sprintf("%s: invalid %s", variablesByName[pe.Name], pe.Type))
			continue
		}
		msgs = append(msgs, e.Error())
	}
	return fmt.Errorf("invalid configuration: %s", strings.Join(msgs, "; "))
}

// variable returns the environment variable of a failed field, such as
// "APP_DB_PORT"; slice elements keep their index ("APP_HTTP_ALLOWED_ORIGINS[1]").
func variable(fe validator.FieldError) string {
	path := strings.TrimPrefix(fe.StructNamespace(), "Config.")
	base, index, found := strings.Cut(path, "[")
	if found {
		index = "[" + index
	}
	return variablesByPath[base] + index
}

// rule formats a failed validation rule, such as "max=65535". Cross-field rules
// (gtfield, gtefield, ...) name another Go field, either a sibling in the same
// group ("ReadTimeout") or a path from Config ("HTTP.WriteTimeout"); report its
// variable instead.
func rule(fe validator.FieldError) string {
	param := fe.Param()
	if param == "" {
		return fe.Tag()
	}
	if strings.HasSuffix(fe.Tag(), "field") {
		group, _, _ := strings.Cut(strings.TrimPrefix(fe.StructNamespace(), "Config."), ".")
		if v, ok := variablesByPath[param]; ok {
			param = v
		} else if v, ok := variablesByPath[group+"."+param]; ok {
			param = v
		}
	}
	return fe.Tag() + "=" + param
}
