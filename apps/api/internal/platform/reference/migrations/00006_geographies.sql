-- Geographies (C215; fields confirmed 2026-10-16): the places addresses pick from, such
-- as the Maldives' atolls, cities, islands, and Malé's wards, or US states. Each has a
-- type of its own country (geography_types) and a parent in the same country; a place of
-- level 1 has none. An address points at the deepest place chosen and holds the rest as
-- text. Global reference data, not tenant-scoped. The schema only: the rows are a seed file.

-- +goose Up
-- A translatable text field keeps its English value in its own column and its other
-- languages beside it in <field>_translations (C216): a JSON object keyed by language tag
-- (BCP 47: dv, ta-IN, zh-Hant), each value a non-blank string; '{}' = none. The one check
-- every table's translations use, as is_current is for active dates. A function, since a
-- CHECK cannot hold a subquery.
CREATE FUNCTION is_translations(translations jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
        SELECT jsonb_typeof(translations) = 'object' AND NOT EXISTS (
            SELECT 1 FROM jsonb_each(translations) AS t (tag, value)
            WHERE t.tag !~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$'
               OR jsonb_typeof(t.value) <> 'string'
               OR btrim(t.value #>> '{}') = '')
    $$;

CREATE TABLE geographies (
    id          uuid        PRIMARY KEY DEFAULT uuidv7(),
    country     char(2)     NOT NULL REFERENCES countries (code) ON DELETE RESTRICT,
    type_id     uuid        NOT NULL,
    parent_id   uuid,                                     -- null only at level 1
    code        text        CHECK (btrim(code) <> ''),    -- official (ISO 3166-2, national)
    name        text        NOT NULL CHECK (btrim(name) <> ''),
    -- The name in other languages, for documents written in them: {"dv": "މާފުށި"}.
    name_translations jsonb NOT NULL DEFAULT '{}' CHECK (is_translations(name_translations)),
    short_name  text        CHECK (btrim(short_name) <> ''),  -- as addresses write it ("K.")
    -- A point for the place (its centre), for maps and rough distances; null where none is
    -- known. An address's own point is the address's, not this.
    latitude    numeric(8,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude   numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
    active_from timestamptz NOT NULL DEFAULT now(),
    active_to   timestamptz CHECK (active_to >= active_from),  -- retired; null = in use
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CHECK ((latitude IS NULL) = (longitude IS NULL)),  -- both or neither
    UNIQUE (country, code),
    -- The target of two-column foreign keys (parent_id, country) here and from addresses:
    -- a place's parent, and an address's place, are of the same country.
    UNIQUE (id, country),
    FOREIGN KEY (type_id, country) REFERENCES geography_types (id, country) ON DELETE RESTRICT,
    FOREIGN KEY (parent_id, country) REFERENCES geographies (id, country) ON DELETE RESTRICT
);

CREATE INDEX geographies_type_id ON geographies (type_id);
-- A place's name is unique among its siblings, not in its country: island names repeat
-- across atolls.
CREATE UNIQUE INDEX geographies_sibling_name
    ON geographies (country, parent_id, type_id, lower(name)) NULLS NOT DISTINCT;
-- Children of a place (the next level's picker); also covers the parent foreign key.
CREATE INDEX geographies_parent_id ON geographies (parent_id);

CREATE TRIGGER geographies_updated_at BEFORE UPDATE ON geographies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The levels hold (C215): a place of level 1 has no parent; any other has a parent of a
-- lower level (skipping levels is allowed: an island under a city, a city under a state
-- while districts are not listed). A CHECK cannot read other rows, so triggers keep it,
-- on the place, and on the changes that could break it later: a place's type, and a
-- type's level.
-- +goose StatementBegin
CREATE FUNCTION geographies_check_level() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    own    smallint;
    parent smallint;
BEGIN
    SELECT level INTO own FROM geography_types WHERE id = NEW.type_id;
    IF NEW.parent_id IS NULL THEN
        IF own <> 1 THEN
            RAISE EXCEPTION 'a place of level % needs a parent', own USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        SELECT t.level INTO parent
        FROM geographies g JOIN geography_types t ON t.id = g.type_id
        WHERE g.id = NEW.parent_id;
        IF parent >= own THEN
            RAISE EXCEPTION 'a place of level % cannot sit under one of level %', own, parent
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND EXISTS (
        SELECT 1 FROM geographies c JOIN geography_types t ON t.id = c.type_id
        WHERE c.parent_id = NEW.id AND t.level <= own
    ) THEN
        RAISE EXCEPTION 'a place of level % cannot keep children of that level or above', own
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END
$$;
-- +goose StatementEnd

CREATE TRIGGER geographies_check_level BEFORE INSERT OR UPDATE OF type_id, parent_id ON geographies
    FOR EACH ROW EXECUTE FUNCTION geographies_check_level();

-- +goose StatementBegin
CREATE FUNCTION geography_types_keep_level() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM geographies WHERE type_id = NEW.id) THEN
        RAISE EXCEPTION 'the level of a type with places cannot change' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END
$$;
-- +goose StatementEnd

CREATE TRIGGER geography_types_keep_level BEFORE UPDATE OF level ON geography_types
    FOR EACH ROW WHEN (NEW.level IS DISTINCT FROM OLD.level)
    EXECUTE FUNCTION geography_types_keep_level();

-- Everyone reads; until the operator write rule exists there is no write policy, so only
-- the owning migration role maintains them (migrations, deploy), as for legal_forms.
ALTER TABLE geographies ENABLE ROW LEVEL SECURITY;
CREATE POLICY geographies_read ON geographies FOR SELECT USING (true);

-- Every change is audited (C164).
SELECT audit.enable('geographies');
