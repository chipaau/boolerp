-- Classification reads (global tables). party_types drives tenant legal-form / identity-doc
-- validation; institution_types selects the provisioning template.

-- name: ListPartyTypes :many
SELECT * FROM party_types WHERE is_active ORDER BY party_type_class, code;

-- name: GetGlobalPartyType :one
SELECT * FROM party_types WHERE code = $1 AND country_code IS NULL;

-- name: ListInstitutionTypes :many
SELECT * FROM institution_types WHERE is_active ORDER BY country_code NULLS FIRST, code;
