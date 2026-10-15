package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
)

// LegalFormListSpec is what GET /api/v1/legal-forms accepts: a country's forms.
var LegalFormListSpec = httpinput.ListSpec{
	Sorts: []string{"name", "code"}, DefaultSort: "name", Search: true,
	Filters: map[string][]string{"country": nil}, Required: []string{"country"},
}

// LegalForm is a legal form as the list shows it; IdentityDocument is the document
// whose number a tenant of this form gives, or nil when it names none.
type LegalForm struct {
	ID, Code, Name, Category string
	IdentityDocument         *string
}

// ListLegalForms reads one page of a country's current legal forms. q matches the name.
func ListLegalForms(ctx context.Context, db Querier, l httpinput.List) ([]LegalForm, int, error) {
	q := query{from: "legal_forms f", where: []string{current("f")},
		sorts: map[string]string{"name": "f.name", "code": "f.code"}, key: "f.id"}
	q.where = append(q.where, "f.country = "+q.arg(l.Filters["country"]))
	if l.Q != "" {
		q.where = append(q.where, "f.name ILIKE "+q.arg("%"+httpinput.Escape(l.Q)+"%"))
	}
	items := []LegalForm{}
	total, err := q.run(ctx, db, l, "f.id::text, f.code, f.name, f.category, f.identity_document", func(rows pgx.Rows, total *int) error {
		var f LegalForm
		if err := rows.Scan(&f.ID, &f.Code, &f.Name, &f.Category, &f.IdentityDocument, total); err != nil {
			return err
		}
		items = append(items, f)
		return nil
	})
	return items, total, err
}

// CurrentLegalForm returns a current legal form's country and the identity document it names
// ("" for none); ok is false when there is no such current form.
func CurrentLegalForm(ctx context.Context, db Querier, id string) (country, document string, ok bool, err error) {
	err = db.QueryRow(ctx, `SELECT f.country, coalesce(f.identity_document, '') FROM legal_forms f
		WHERE f.id = $1 AND `+current("f"), id).Scan(&country, &document)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	return country, document, err == nil, err
}
