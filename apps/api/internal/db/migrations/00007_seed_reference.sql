-- Seed reference + classification data every environment needs on boot. Idempotent
-- (ON CONFLICT on natural/unique keys) so re-running `migrate up` is safe. Content confirmed
-- against DB-FOUNDATION.md seed notes. Actual geographies nodes (MV atolls/islands) are a
-- larger sourced dataset, seeded when the address feature lands.
-- +goose Up

-- currencies (name_dv is NOT NULL) ---------------------------------------------------------------
INSERT INTO currencies (code, name, name_dv, symbol) VALUES
  ('MVR', 'Maldivian Rufiyaa', 'ދިވެހި ރުފިޔާ', 'Rf'),
  ('USD', 'US Dollar',         'ޔޫއެސް ޑޮލަރު', '$')
ON CONFLICT (code) DO NOTHING;

-- countries — ISO 3166-1 alpha-2. name_dv falls back to English except MV/IN/LK (NOT NULL column);
-- default_locale = 'dv' for Maldives, else 'en'. dial_code = country calling code. -------------------
INSERT INTO countries (code, name, name_dv, dial_code, default_locale) VALUES
  ('AD','Andorra','Andorra','+376','en'),
  ('AE','United Arab Emirates','United Arab Emirates','+971','en'),
  ('AF','Afghanistan','Afghanistan','+93','en'),
  ('AG','Antigua and Barbuda','Antigua and Barbuda','+1','en'),
  ('AL','Albania','Albania','+355','en'),
  ('AM','Armenia','Armenia','+374','en'),
  ('AO','Angola','Angola','+244','en'),
  ('AR','Argentina','Argentina','+54','en'),
  ('AT','Austria','Austria','+43','en'),
  ('AU','Australia','Australia','+61','en'),
  ('AZ','Azerbaijan','Azerbaijan','+994','en'),
  ('BA','Bosnia and Herzegovina','Bosnia and Herzegovina','+387','en'),
  ('BB','Barbados','Barbados','+1','en'),
  ('BD','Bangladesh','Bangladesh','+880','en'),
  ('BE','Belgium','Belgium','+32','en'),
  ('BF','Burkina Faso','Burkina Faso','+226','en'),
  ('BG','Bulgaria','Bulgaria','+359','en'),
  ('BH','Bahrain','Bahrain','+973','en'),
  ('BI','Burundi','Burundi','+257','en'),
  ('BJ','Benin','Benin','+229','en'),
  ('BN','Brunei Darussalam','Brunei Darussalam','+673','en'),
  ('BO','Bolivia','Bolivia','+591','en'),
  ('BR','Brazil','Brazil','+55','en'),
  ('BS','Bahamas','Bahamas','+1','en'),
  ('BT','Bhutan','Bhutan','+975','en'),
  ('BW','Botswana','Botswana','+267','en'),
  ('BY','Belarus','Belarus','+375','en'),
  ('BZ','Belize','Belize','+501','en'),
  ('CA','Canada','Canada','+1','en'),
  ('CD','Congo (DRC)','Congo (DRC)','+243','en'),
  ('CF','Central African Republic','Central African Republic','+236','en'),
  ('CG','Congo','Congo','+242','en'),
  ('CH','Switzerland','Switzerland','+41','en'),
  ('CI','Côte d''Ivoire','Côte d''Ivoire','+225','en'),
  ('CL','Chile','Chile','+56','en'),
  ('CM','Cameroon','Cameroon','+237','en'),
  ('CN','China','China','+86','en'),
  ('CO','Colombia','Colombia','+57','en'),
  ('CR','Costa Rica','Costa Rica','+506','en'),
  ('CU','Cuba','Cuba','+53','en'),
  ('CV','Cabo Verde','Cabo Verde','+238','en'),
  ('CY','Cyprus','Cyprus','+357','en'),
  ('CZ','Czechia','Czechia','+420','en'),
  ('DE','Germany','Germany','+49','en'),
  ('DJ','Djibouti','Djibouti','+253','en'),
  ('DK','Denmark','Denmark','+45','en'),
  ('DM','Dominica','Dominica','+1','en'),
  ('DO','Dominican Republic','Dominican Republic','+1','en'),
  ('DZ','Algeria','Algeria','+213','en'),
  ('EC','Ecuador','Ecuador','+593','en'),
  ('EE','Estonia','Estonia','+372','en'),
  ('EG','Egypt','Egypt','+20','en'),
  ('ER','Eritrea','Eritrea','+291','en'),
  ('ES','Spain','Spain','+34','en'),
  ('ET','Ethiopia','Ethiopia','+251','en'),
  ('FI','Finland','Finland','+358','en'),
  ('FJ','Fiji','Fiji','+679','en'),
  ('FM','Micronesia','Micronesia','+691','en'),
  ('FR','France','France','+33','en'),
  ('GA','Gabon','Gabon','+241','en'),
  ('GB','United Kingdom','United Kingdom','+44','en'),
  ('GD','Grenada','Grenada','+1','en'),
  ('GE','Georgia','Georgia','+995','en'),
  ('GH','Ghana','Ghana','+233','en'),
  ('GM','Gambia','Gambia','+220','en'),
  ('GN','Guinea','Guinea','+224','en'),
  ('GQ','Equatorial Guinea','Equatorial Guinea','+240','en'),
  ('GR','Greece','Greece','+30','en'),
  ('GT','Guatemala','Guatemala','+502','en'),
  ('GW','Guinea-Bissau','Guinea-Bissau','+245','en'),
  ('GY','Guyana','Guyana','+592','en'),
  ('HN','Honduras','Honduras','+504','en'),
  ('HR','Croatia','Croatia','+385','en'),
  ('HT','Haiti','Haiti','+509','en'),
  ('HU','Hungary','Hungary','+36','en'),
  ('ID','Indonesia','Indonesia','+62','en'),
  ('IE','Ireland','Ireland','+353','en'),
  ('IL','Israel','Israel','+972','en'),
  ('IN','India','އިންޑިއާ','+91','en'),
  ('IQ','Iraq','Iraq','+964','en'),
  ('IR','Iran','Iran','+98','en'),
  ('IS','Iceland','Iceland','+354','en'),
  ('IT','Italy','Italy','+39','en'),
  ('JM','Jamaica','Jamaica','+1','en'),
  ('JO','Jordan','Jordan','+962','en'),
  ('JP','Japan','Japan','+81','en'),
  ('KE','Kenya','Kenya','+254','en'),
  ('KG','Kyrgyzstan','Kyrgyzstan','+996','en'),
  ('KH','Cambodia','Cambodia','+855','en'),
  ('KI','Kiribati','Kiribati','+686','en'),
  ('KM','Comoros','Comoros','+269','en'),
  ('KN','Saint Kitts and Nevis','Saint Kitts and Nevis','+1','en'),
  ('KP','North Korea','North Korea','+850','en'),
  ('KR','South Korea','South Korea','+82','en'),
  ('KW','Kuwait','Kuwait','+965','en'),
  ('KZ','Kazakhstan','Kazakhstan','+7','en'),
  ('LA','Laos','Laos','+856','en'),
  ('LB','Lebanon','Lebanon','+961','en'),
  ('LC','Saint Lucia','Saint Lucia','+1','en'),
  ('LI','Liechtenstein','Liechtenstein','+423','en'),
  ('LK','Sri Lanka','ސްރީ ލަންކާ','+94','en'),
  ('LR','Liberia','Liberia','+231','en'),
  ('LS','Lesotho','Lesotho','+266','en'),
  ('LT','Lithuania','Lithuania','+370','en'),
  ('LU','Luxembourg','Luxembourg','+352','en'),
  ('LV','Latvia','Latvia','+371','en'),
  ('LY','Libya','Libya','+218','en'),
  ('MA','Morocco','Morocco','+212','en'),
  ('MC','Monaco','Monaco','+377','en'),
  ('MD','Moldova','Moldova','+373','en'),
  ('ME','Montenegro','Montenegro','+382','en'),
  ('MG','Madagascar','Madagascar','+261','en'),
  ('MH','Marshall Islands','Marshall Islands','+692','en'),
  ('MK','North Macedonia','North Macedonia','+389','en'),
  ('ML','Mali','Mali','+223','en'),
  ('MM','Myanmar','Myanmar','+95','en'),
  ('MN','Mongolia','Mongolia','+976','en'),
  ('MR','Mauritania','Mauritania','+222','en'),
  ('MT','Malta','Malta','+356','en'),
  ('MU','Mauritius','Mauritius','+230','en'),
  ('MV','Maldives','ދިވެހިރާއްޖެ','+960','dv'),
  ('MW','Malawi','Malawi','+265','en'),
  ('MX','Mexico','Mexico','+52','en'),
  ('MY','Malaysia','Malaysia','+60','en'),
  ('MZ','Mozambique','Mozambique','+258','en'),
  ('NA','Namibia','Namibia','+264','en'),
  ('NE','Niger','Niger','+227','en'),
  ('NG','Nigeria','Nigeria','+234','en'),
  ('NI','Nicaragua','Nicaragua','+505','en'),
  ('NL','Netherlands','Netherlands','+31','en'),
  ('NO','Norway','Norway','+47','en'),
  ('NP','Nepal','Nepal','+977','en'),
  ('NR','Nauru','Nauru','+674','en'),
  ('NZ','New Zealand','New Zealand','+64','en'),
  ('OM','Oman','Oman','+968','en'),
  ('PA','Panama','Panama','+507','en'),
  ('PE','Peru','Peru','+51','en'),
  ('PG','Papua New Guinea','Papua New Guinea','+675','en'),
  ('PH','Philippines','Philippines','+63','en'),
  ('PK','Pakistan','Pakistan','+92','en'),
  ('PL','Poland','Poland','+48','en'),
  ('PS','Palestine','Palestine','+970','en'),
  ('PT','Portugal','Portugal','+351','en'),
  ('PW','Palau','Palau','+680','en'),
  ('PY','Paraguay','Paraguay','+595','en'),
  ('QA','Qatar','Qatar','+974','en'),
  ('RO','Romania','Romania','+40','en'),
  ('RS','Serbia','Serbia','+381','en'),
  ('RU','Russia','Russia','+7','en'),
  ('RW','Rwanda','Rwanda','+250','en'),
  ('SA','Saudi Arabia','Saudi Arabia','+966','en'),
  ('SB','Solomon Islands','Solomon Islands','+677','en'),
  ('SC','Seychelles','Seychelles','+248','en'),
  ('SD','Sudan','Sudan','+249','en'),
  ('SE','Sweden','Sweden','+46','en'),
  ('SG','Singapore','Singapore','+65','en'),
  ('SI','Slovenia','Slovenia','+386','en'),
  ('SK','Slovakia','Slovakia','+421','en'),
  ('SL','Sierra Leone','Sierra Leone','+232','en'),
  ('SM','San Marino','San Marino','+378','en'),
  ('SN','Senegal','Senegal','+221','en'),
  ('SO','Somalia','Somalia','+252','en'),
  ('SR','Suriname','Suriname','+597','en'),
  ('SS','South Sudan','South Sudan','+211','en'),
  ('ST','Sao Tome and Principe','Sao Tome and Principe','+239','en'),
  ('SV','El Salvador','El Salvador','+503','en'),
  ('SY','Syria','Syria','+963','en'),
  ('SZ','Eswatini','Eswatini','+268','en'),
  ('TD','Chad','Chad','+235','en'),
  ('TG','Togo','Togo','+228','en'),
  ('TH','Thailand','Thailand','+66','en'),
  ('TJ','Tajikistan','Tajikistan','+992','en'),
  ('TL','Timor-Leste','Timor-Leste','+670','en'),
  ('TM','Turkmenistan','Turkmenistan','+993','en'),
  ('TN','Tunisia','Tunisia','+216','en'),
  ('TO','Tonga','Tonga','+676','en'),
  ('TR','Türkiye','Türkiye','+90','en'),
  ('TT','Trinidad and Tobago','Trinidad and Tobago','+1','en'),
  ('TV','Tuvalu','Tuvalu','+688','en'),
  ('TW','Taiwan','Taiwan','+886','en'),
  ('TZ','Tanzania','Tanzania','+255','en'),
  ('UA','Ukraine','Ukraine','+380','en'),
  ('UG','Uganda','Uganda','+256','en'),
  ('US','United States','United States','+1','en'),
  ('UY','Uruguay','Uruguay','+598','en'),
  ('UZ','Uzbekistan','Uzbekistan','+998','en'),
  ('VA','Holy See','Holy See','+379','en'),
  ('VC','Saint Vincent and the Grenadines','Saint Vincent and the Grenadines','+1','en'),
  ('VE','Venezuela','Venezuela','+58','en'),
  ('VN','Vietnam','Vietnam','+84','en'),
  ('VU','Vanuatu','Vanuatu','+678','en'),
  ('WS','Samoa','Samoa','+685','en'),
  ('XK','Kosovo','Kosovo','+383','en'),
  ('YE','Yemen','Yemen','+967','en'),
  ('ZA','South Africa','South Africa','+27','en'),
  ('ZM','Zambia','Zambia','+260','en'),
  ('ZW','Zimbabwe','Zimbabwe','+263','en')
ON CONFLICT (code) DO NOTHING;

-- geography_levels — global default set + Maldives-specific set (name_dv is nullable) --------------
INSERT INTO geography_levels (country_code, level_no, code, name, name_dv) VALUES
  (NULL, 1, 'region',   'Region',   NULL),
  (NULL, 2, 'district', 'District', NULL),
  (NULL, 3, 'city',     'City',     NULL),
  ('MV', 1, 'atoll',    'Atoll',    'އަތޮޅު'),
  ('MV', 2, 'island',   'Island',   'ރަށް'),
  ('MV', 3, 'ward',     'Ward',     'އަވަށް')
ON CONFLICT ON CONSTRAINT uq_geo_levels_no DO NOTHING;

-- party_types — global tree (name_dv nullable; filled only where confident). Roots first, then
-- children referencing parents by code so parent_id resolves regardless of uuidv7 values. ----------
INSERT INTO party_types (parent_id, party_type_class, code, name, name_dv, allowed_identity_types) VALUES
  (NULL, 'individual',   'individual',   'Individual',   NULL, '[]'),
  (NULL, 'organisation', 'organisation', 'Organisation', NULL, '[]')
ON CONFLICT ON CONSTRAINT uq_party_types_code DO NOTHING;

INSERT INTO party_types (parent_id, party_type_class, code, name, name_dv, allowed_identity_types)
SELECT p.id, 'individual', v.code, v.name, v.name_dv, v.aidt::jsonb
FROM (VALUES
  ('local',       'Local',       'ދިވެހި', '["national_id"]'),
  ('foreign',     'Foreign',     'ބިދޭސީ', '["passport"]'),
  ('work-permit', 'Work Permit', NULL,     '["work_permit","passport"]')
) AS v(code, name, name_dv, aidt)
CROSS JOIN (SELECT id FROM party_types WHERE code = 'individual' AND country_code IS NULL) p
ON CONFLICT ON CONSTRAINT uq_party_types_code DO NOTHING;

INSERT INTO party_types (parent_id, party_type_class, code, name, name_dv, allowed_identity_types)
SELECT p.id, 'organisation', v.code, v.name, v.name_dv, v.aidt::jsonb
FROM (VALUES
  ('government',      'Government',      'ސަރުކާރު', '[]'),
  ('ngo',             'NGO',             NULL,       '["ngo_registration"]'),
  ('sole-proprietor', 'Sole Proprietor', NULL,       '["business_registration"]'),
  ('company',         'Company',         'ކުންފުނި', '[]'),
  ('partnership',     'Partnership',     NULL,       '["partnership_registration"]')
) AS v(code, name, name_dv, aidt)
CROSS JOIN (SELECT id FROM party_types WHERE code = 'organisation' AND country_code IS NULL) p
ON CONFLICT ON CONSTRAINT uq_party_types_code DO NOTHING;

INSERT INTO party_types (parent_id, party_type_class, code, name, name_dv, allowed_identity_types)
SELECT p.id, 'organisation', v.code, v.name, v.name_dv, v.aidt::jsonb
FROM (VALUES
  ('public-company',  'Public Company',  NULL, '["company_registration"]'),
  ('private-company', 'Private Company', NULL, '["company_registration"]')
) AS v(code, name, name_dv, aidt)
CROSS JOIN (SELECT id FROM party_types WHERE code = 'company' AND country_code IS NULL) p
ON CONFLICT ON CONSTRAINT uq_party_types_code DO NOTHING;

-- institution_types — global set + MV council. Flat (no parent). template_key selects the
-- provisioning blueprint; NULL = generic default (Business). name_dv nullable. ---------------------
INSERT INTO institution_types (country_code, parent_id, code, name, name_dv, template_key) VALUES
  (NULL, NULL, 'business',      'Business',      NULL,          NULL),
  (NULL, NULL, 'hospital',      'Hospital',      'ހޮސްޕިޓަލް', 'health_facility'),
  (NULL, NULL, 'clinic',        'Clinic',        NULL,          'health_facility'),
  (NULL, NULL, 'health-centre', 'Health Centre', NULL,          'health_facility'),
  (NULL, NULL, 'school',        'School',        'ސްކޫލް',      'education'),
  (NULL, NULL, 'university',    'University',    NULL,          'education'),
  (NULL, NULL, 'ministry',      'Ministry',      'މިނިސްޓްރީ',  'government_office'),
  (NULL, NULL, 'ngo-office',    'NGO Office',    NULL,          'ngo_office'),
  ('MV', NULL, 'council',       'Council',       'ކައުންސިލް',  'council')
ON CONFLICT ON CONSTRAINT uq_institution_types_code DO NOTHING;

-- +goose Down
DELETE FROM party_types WHERE country_code IS NULL AND code IN ('public-company','private-company');
DELETE FROM party_types WHERE country_code IS NULL AND parent_id IS NOT NULL;
DELETE FROM party_types WHERE country_code IS NULL AND code IN ('individual','organisation');
DELETE FROM institution_types WHERE country_code IS NULL OR (country_code = 'MV' AND code = 'council');
DELETE FROM geography_levels WHERE country_code IS NULL OR country_code = 'MV';
DELETE FROM countries;
DELETE FROM currencies;
