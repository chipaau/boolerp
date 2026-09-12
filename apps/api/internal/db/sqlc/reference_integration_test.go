//go:build integration

package sqlc_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/Bool-Maldives/erp/internal/db/sqlc"
	"github.com/Bool-Maldives/erp/internal/dbtest"
)

var env *dbtest.Env

func TestMain(m *testing.M) {
	ctx := context.Background()
	e, err := dbtest.Start(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, "dbtest start:", err)
		os.Exit(1)
	}
	env = e
	code := m.Run()
	env.Close(ctx)
	os.Exit(code)
}

// Proves the pipeline end to end: container → migrations → seeds → sqlc query over a rolled-back tx.
func TestReferenceSeeds(t *testing.T) {
	ctx := context.Background()
	q := sqlc.New(env.Tx(t))

	currencies, err := q.ListCurrencies(ctx)
	if err != nil {
		t.Fatalf("ListCurrencies: %v", err)
	}
	if len(currencies) != 2 {
		t.Fatalf("currencies: want 2, got %d", len(currencies))
	}
	codes := map[string]bool{}
	for _, c := range currencies {
		codes[c.Code] = true
	}
	if !codes["MVR"] || !codes["USD"] {
		t.Fatalf("currencies: want MVR+USD, got %v", codes)
	}

	countries, err := q.ListCountries(ctx)
	if err != nil {
		t.Fatalf("ListCountries: %v", err)
	}
	if len(countries) != 197 {
		t.Fatalf("countries: want 197, got %d", len(countries))
	}

	mv, err := q.GetCountry(ctx, "MV")
	if err != nil {
		t.Fatalf("GetCountry(MV): %v", err)
	}
	var mvNames map[string]string
	if err := json.Unmarshal(mv.NameI18n, &mvNames); err != nil {
		t.Fatalf("MV name_i18n: unmarshal: %v", err)
	}
	if mvNames["dv"] == "" {
		t.Fatalf("MV name_i18n: want a 'dv' key, got %v", mvNames)
	}

	parties, err := q.ListPartyTypes(ctx)
	if err != nil {
		t.Fatalf("ListPartyTypes: %v", err)
	}
	// Flat seed (no root/grouping nodes): 3 individual + 6 organisation.
	if len(parties) != 9 {
		t.Fatalf("party_types: want 9, got %d", len(parties))
	}
}

// Proves the harness isolates tests: a write in one tx is invisible after rollback.
func TestTxRollbackIsolation(t *testing.T) {
	ctx := context.Background()

	base, err := sqlc.New(env.Pool).ListCurrencies(ctx)
	if err != nil {
		t.Fatalf("baseline: %v", err)
	}

	tx, err := env.Pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO currencies (code, name, symbol) VALUES ('TST','Test','T')`,
	); err != nil {
		t.Fatalf("insert: %v", err)
	}
	inTx, err := sqlc.New(tx).ListCurrencies(ctx)
	if err != nil {
		t.Fatalf("in-tx list: %v", err)
	}
	if len(inTx) != len(base)+1 {
		t.Fatalf("in-tx: want %d, got %d", len(base)+1, len(inTx))
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatalf("rollback: %v", err)
	}

	after, err := sqlc.New(env.Pool).ListCurrencies(ctx)
	if err != nil {
		t.Fatalf("after: %v", err)
	}
	if len(after) != len(base) {
		t.Fatalf("after rollback: want %d, got %d", len(base), len(after))
	}
}
