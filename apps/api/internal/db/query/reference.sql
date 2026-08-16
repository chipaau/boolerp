-- Reference-data reads (global tables — no tenant scope). Starter query set to wire sqlc.

-- name: ListCurrencies :many
SELECT * FROM currencies WHERE is_active ORDER BY code;

-- name: GetCurrency :one
SELECT * FROM currencies WHERE code = $1;

-- name: ListCountries :many
SELECT * FROM countries WHERE is_active ORDER BY name;

-- name: GetCountry :one
SELECT * FROM countries WHERE code = $1;

-- name: ListGeographyLevels :many
-- Both the global (country_code NULL) set and any country-specific sets; resolution
-- (own set if any, else global) is applied in app logic.
SELECT * FROM geography_levels WHERE is_active ORDER BY country_code NULLS FIRST, level_no;
