-- Reference-data reads (global tables — no tenant scope). Starter query set to wire sqlc.

-- name: ListCurrencies :many
SELECT * FROM currencies WHERE active_to IS NULL ORDER BY code;

-- name: GetCurrency :one
SELECT * FROM currencies WHERE code = $1;

-- name: ListCountries :many
SELECT * FROM countries WHERE active_to IS NULL ORDER BY name;

-- name: GetCountry :one
SELECT * FROM countries WHERE code = $1;

-- name: ActiveCountryExists :one
-- Validates a caller-supplied country code against the reference table rather than a regex: a
-- well-formed pair of letters like 'ZZ' is not a country. Requires the row to be CURRENT (active_to
-- IS NULL), so a retired country can't be chosen for something new. tenants.country is an FK to this
-- table, so without this an unknown code surfaces as a foreign-key violation from deep inside
-- provisioning — a 500 for what is really a bad field.
SELECT EXISTS (SELECT 1 FROM countries WHERE code = $1 AND active_to IS NULL);

-- name: ListGeographyLevels :many
-- Both the global (country_code NULL) set and any country-specific sets; resolution
-- (own set if any, else global) is applied in app logic.
SELECT * FROM geography_levels WHERE active_to IS NULL ORDER BY country_code NULLS FIRST, level_no;
