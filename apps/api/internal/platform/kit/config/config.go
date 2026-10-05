// Package config loads and validates runtime settings from the process environment.
//
// Settings are grouped by concern, one file per group: app.go (APP_*), log.go
// (APP_LOG_*), http.go (APP_HTTP_*), database.go (APP_DB_*), redis.go
// (APP_REDIS_*), auth.go (APP_AUTH_*), identity.go (APP_IDENTITY_*), and
// platform.go (APP_PLATFORM_*, used by cmd/seed and cmd/deploy). Each group is a
// struct whose env tags are joined to its envPrefix, so DB.Host reads APP_DB_HOST.
// cmd/migrate has its own settings (migrate.go, MIGRATE_*), loaded by LoadMigrate,
// and cmd/bff its own (bff.go, BFF_*), loaded by LoadBFF.
//
// Passwords are read only from files (C80), as Docker and Kubernetes mount
// secrets: the variable (APP_DB_PASSWORD_FILE) names the file, and
// caarlos0/env's "file" option reads it into the field.
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

// Config holds every API runtime setting. Each field names its environment
// variable (env, joined to the group's envPrefix), its default when unset or
// empty (envDefault), and its rules (validate).
type Config struct {
	App      App      `envPrefix:"APP_"`
	Log      Log      `envPrefix:"APP_LOG_"`
	HTTP     HTTP     `envPrefix:"APP_HTTP_"`
	DB       DB       `envPrefix:"APP_DB_"`
	Redis    Redis    `envPrefix:"APP_REDIS_"`
	Auth     Auth     `envPrefix:"APP_AUTH_"`
	Identity Identity `envPrefix:"APP_IDENTITY_"`
	Cerbos   Cerbos   `envPrefix:"APP_CERBOS_"`
}

// Load reads the API's settings from environ, which uses the os.Environ
// "KEY=value" form. Errors name the variable but never include its value.
func Load(environ []string) (Config, error) {
	return load[Config](environ, validateAcrossGroups)
}

// validateAcrossGroups checks rules that span groups: validator's cross-struct
// tags only reach structs nested inside the tagged one, not sibling groups.
// Errors are reported with the field's path, so they are named like any other.
func validateAcrossGroups(sl validator.StructLevel) {
	cfg := sl.Current().Interface().(Config)
	// Graceful shutdown must let any request the server allows finish (C30).
	if cfg.App.ShutdownTimeout < cfg.HTTP.WriteTimeout {
		sl.ReportError(cfg.App.ShutdownTimeout, "ShutdownTimeout", "App.ShutdownTimeout", "gtefield", "HTTP.WriteTimeout")
	}
	// Authorization traffic is encrypted in staging and production; development and
	// automated tests run on an internal network (C152, C155).
	if cfg.Cerbos.TLSCAFile == "" && cfg.App.Environment != "dev" && cfg.App.Environment != "test" {
		sl.ReportError(cfg.Cerbos.TLSCAFile, "TLSCAFile", "Cerbos.TLSCAFile", "required_outside_dev_and_test", "")
	}
}

// load parses and validates a settings struct T whose fields are groups.
// acrossGroups, when not nil, checks rules that span groups.
func load[T any](environ []string, acrossGroups validator.StructLevelFunc) (T, error) {
	var zero T
	names := variables(reflect.TypeFor[T]())

	// Parse one group at a time, with its prefix. caarlos0/env's ParseError
	// reports only the field name, so a parse error is resolved within its own
	// group; groups may therefore reuse field names (DB.Host, Redis.Host).
	var cfg T
	vars := env.ToMap(environ)
	top := reflect.ValueOf(&cfg).Elem()
	var msgs []string
	for i := range top.NumField() {
		group := top.Type().Field(i)
		err := env.ParseWithOptions(top.Field(i).Addr().Interface(), env.Options{
			Environment: vars,
			Prefix:      group.Tag.Get("envPrefix"),
		})
		if err != nil {
			msgs = append(msgs, redactParseErrors(err, names.groups[group.Name])...)
		}
	}
	if len(msgs) > 0 {
		return zero, fmt.Errorf("invalid configuration: %s", strings.Join(msgs, "; "))
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
		return zero, err
	}
	if acrossGroups != nil {
		validate.RegisterStructValidation(acrossGroups, zero)
	}

	if err := validate.Struct(cfg); err != nil {
		var fieldErrs validator.ValidationErrors
		if !errors.As(err, &fieldErrs) {
			return zero, err
		}
		msgs := make([]string, 0, len(fieldErrs))
		for _, fe := range fieldErrs {
			// FieldError.Value() holds the rejected value; it is deliberately not used.
			msgs = append(msgs, fmt.Sprintf("%s: must satisfy %s", names.variable(fe), names.rule(fe)))
		}
		return zero, fmt.Errorf("invalid configuration: %s", strings.Join(msgs, "; "))
	}

	return cfg, nil
}

// variableNames maps each setting of one settings struct to its environment
// variable: by Go field path ("DB.Port"), and per group by field name
// (groups["DB"]["Port"]), since a parse error names only the field.
type variableNames struct {
	byPath map[string]string
	groups map[string]map[string]string
}

func variables(top reflect.Type) variableNames {
	n := variableNames{byPath: map[string]string{}, groups: map[string]map[string]string{}}
	for i := range top.NumField() {
		group := top.Field(i)
		prefix := group.Tag.Get("envPrefix")
		n.groups[group.Name] = map[string]string{}
		for j := range group.Type.NumField() {
			f := group.Type.Field(j)
			name, _, _ := strings.Cut(f.Tag.Get("env"), ",")
			n.byPath[group.Name+"."+f.Name] = prefix + name
			n.groups[group.Name][f.Name] = prefix + name
		}
	}
	return n
}

// redactParseErrors returns one message per error in err, replacing
// env.ParseError messages, which embed the rejected value (for example
// `parsing "abc"`), with the variable name and expected type. byName maps the
// group's field names to variables. This is the documented gap in
// caarlos0/env; its other errors contain only names.
func redactParseErrors(err error, byName map[string]string) []string {
	var agg env.AggregateError
	if !errors.As(err, &agg) {
		return []string{err.Error()}
	}
	msgs := make([]string, 0, len(agg.Errors))
	for _, e := range agg.Errors {
		var pe env.ParseError
		if errors.As(e, &pe) {
			msgs = append(msgs, fmt.Sprintf("%s: invalid %s", byName[pe.Name], pe.Type))
			continue
		}
		msgs = append(msgs, e.Error())
	}
	return msgs
}

// path returns a failed field's path without the top struct's name, such as
// "DB.Port" from "Config.DB.Port".
func path(fe validator.FieldError) string {
	_, p, _ := strings.Cut(fe.StructNamespace(), ".")
	return p
}

// variable returns the environment variable of a failed field, such as
// "APP_DB_PORT"; slice elements keep their index ("APP_HTTP_ALLOWED_ORIGINS[1]").
func (n variableNames) variable(fe validator.FieldError) string {
	base, index, found := strings.Cut(path(fe), "[")
	if found {
		index = "[" + index
	}
	return n.byPath[base] + index
}

// rule formats a failed validation rule, such as "max=65535". Cross-field rules
// (gtfield, gtefield, ...) name another Go field, either a sibling in the same
// group ("ReadTimeout") or a path from the top struct ("HTTP.WriteTimeout");
// report its variable instead.
func (n variableNames) rule(fe validator.FieldError) string {
	param := fe.Param()
	if param == "" {
		return fe.Tag()
	}
	if strings.HasSuffix(fe.Tag(), "field") {
		group, _, _ := strings.Cut(path(fe), ".")
		if v, ok := n.byPath[param]; ok {
			param = v
		} else if v, ok := n.byPath[group+"."+param]; ok {
			param = v
		}
	}
	return fe.Tag() + "=" + param
}
