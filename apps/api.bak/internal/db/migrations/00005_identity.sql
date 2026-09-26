-- Identity — platform control-plane, NOT under tenant RLS. One global identity spans all tenants;
-- users.id = the Kratos subject. Verified-identity data (eFaas) hangs off users 1:1 so core stays lean.
-- +goose Up

-- users — lean projection of the Kratos identity. A row exists only because an operator or tenant admin
-- provisioned it: sign-in VERIFIES this row, never creates it (authentication is not admission).
-- No credentials (Kratos owns them).
CREATE TABLE users (
  id            uuid        PRIMARY KEY,               -- = Kratos identity id (IdP subject); no DEFAULT — supplied by Kratos
  email         text        NOT NULL UNIQUE,           -- mirror of Kratos email trait; one global identity per email
  name          text        NOT NULL,                  -- canonical/operational name (English)
  name_i18n     jsonb       NOT NULL DEFAULT '{}',     -- local-script name for DOCUMENT GENERATION only, e.g. {"dv": "..."} — sparse, synced from the Kratos name_i18n trait
  phone         text,
  status        text        NOT NULL DEFAULT 'active', -- 'active' | 'disabled' (disable revokes sessions, UC-AUTH-11)
  last_login_at timestamptz,                           -- set on login/whoami; NULL until first login
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_status CHECK (status IN ('active','disabled'))
);

-- user_efaas_identities — eFaas verified identity, 1:1 with users (a row ⇔ eFaas-verified). Global.
-- Most PII-sensitive foundation table — read access tightly gated + audited (components 05/06).
CREATE TABLE user_efaas_identities (
  user_id           uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,  -- 1:1 (PK = user_id)
  efaas_sub         text        NOT NULL UNIQUE,          -- eFaas OIDC 'sub' — matches a returning eFaas login
  id_number         text        NOT NULL UNIQUE,          -- national ID / A-number — one login per national identity
  name_en           text,                                 -- verified legal English name (may differ from users.name)
  name_dv           text,                                 -- verified legal Dhivehi name
  dob               date,                                 -- date of birth (calendar fact → date)
  gender            text,
  permanent_address jsonb,                                -- structured address components from eFaas
  present_address   jsonb,
  photo_ref         text,                                 -- pointer to photo in object storage, NOT the bytes
  mobile            text,
  email             text,                                 -- eFaas-verified email (may differ from users.email)
  claims            jsonb       NOT NULL DEFAULT '{}',    -- raw eFaas claim set (future-proof)
  verified_at       timestamptz NOT NULL DEFAULT now(),
  last_synced_at    timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON user_efaas_identities (id_number);        -- link a person to HR/party records by national ID

-- +goose Down
DROP TABLE IF EXISTS user_efaas_identities;
DROP TABLE IF EXISTS users;
