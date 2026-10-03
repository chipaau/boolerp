package seeds

import (
	"context"
	_ "embed"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed legal_forms.csv
var legalFormsCSV []byte

// LegalForm is one row of legal_forms.csv. An empty IdentityDocument means the
// form's organisations carry no registration number.
type LegalForm struct {
	Country, Code, Name, Category, IdentityDocument string
}

// The same rules as the table's CHECK constraints.
var (
	legalFormCode = regexp.MustCompile(`^[a-z][a-z0-9_]{1,49}$`)
	categories    = []string{"government", "private", "non_profit", "international"}
)

// ParseLegalForms reads legal forms CSV: a header, then one form per line. It
// rejects a malformed row or a code repeated within a country.
func ParseLegalForms(data []byte) ([]LegalForm, error) {
	records, err := readCSV("legal forms", data, "country", "code", "name", "category", "identity_document")
	if err != nil {
		return nil, err
	}
	var forms []LegalForm
	seen := map[string]bool{}
	for _, rec := range records {
		f := LegalForm{Country: rec[0], Code: rec[1], Name: rec[2], Category: rec[3], IdentityDocument: rec[4]}
		key := f.Country + "/" + f.Code
		switch {
		case !codePattern.MatchString(f.Country):
			return nil, fmt.Errorf("legal forms: country %q is not ISO alpha-2", f.Country)
		case !legalFormCode.MatchString(f.Code):
			return nil, fmt.Errorf("legal forms %s: code %q", f.Country, f.Code)
		case strings.TrimSpace(f.Name) == "":
			return nil, fmt.Errorf("legal forms %s: blank name", key)
		case !slices.Contains(categories, f.Category):
			return nil, fmt.Errorf("legal forms %s: category %q", key, f.Category)
		case f.IdentityDocument != "" && strings.TrimSpace(f.IdentityDocument) == "":
			return nil, fmt.Errorf("legal forms %s: blank identity document", key)
		case seen[key]:
			return nil, fmt.Errorf("legal forms: duplicate %s", key)
		}
		seen[key] = true
		forms = append(forms, f)
	}
	return forms, nil
}

// LegalForms seeds every country's legal forms from legal_forms.csv. It runs
// after Countries, whose rows the forms reference.
type LegalForms struct {
	db   DB
	data []byte
}

// NewLegalForms returns the seeder over db, with the embedded lists.
func NewLegalForms(db DB) *LegalForms { return &LegalForms{db: db, data: legalFormsCSV} }

// Name implements seed.Seeder.
func (*LegalForms) Name() string { return "reference.legal_forms" }

// upsertLegalForm adds a form or updates a changed one (see upsertAll). Retirement
// dates are the operators' and are never touched, and no row is ever deleted.
const upsertLegalForm = `
INSERT INTO legal_forms (country, code, name, category, identity_document)
VALUES ($1, $2, $3, $4, NULLIF($5, ''))
ON CONFLICT (country, code) DO UPDATE
   SET name = EXCLUDED.name, category = EXCLUDED.category,
       identity_document = EXCLUDED.identity_document
 WHERE (legal_forms.name, legal_forms.category, legal_forms.identity_document)
       IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.category, EXCLUDED.identity_document)
RETURNING xmax = 0`

// Run implements seed.Seeder, in one transaction like Countries.
func (l *LegalForms) Run(ctx context.Context, env seed.Env) error {
	forms, err := ParseLegalForms(l.data)
	if err != nil {
		return err
	}
	rows := make([]row, len(forms))
	for i, f := range forms {
		rows[i] = row{key: f.Country + "/" + f.Code, args: []any{f.Country, f.Code, f.Name, f.Category, f.IdentityDocument}}
	}
	n, err := upsertAll(ctx, l.db, upsertLegalForm, rows)
	if err != nil {
		return fmt.Errorf("legal form %w", err)
	}
	env.Logger.InfoContext(ctx, "legal forms seeded", "inserted", n.inserted, "updated", n.updated, "unchanged", n.unchanged)
	return nil
}
