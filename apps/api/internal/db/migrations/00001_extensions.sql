-- Foundation extensions. ltree backs the tenant/geography hierarchies (materialised
-- `path` columns + GiST indexes). uuidv7() is built into Postgres 18 (no extension).
-- +goose Up
CREATE EXTENSION IF NOT EXISTS ltree;

-- +goose Down
DROP EXTENSION IF EXISTS ltree;
