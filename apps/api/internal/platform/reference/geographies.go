package reference

import (
	"cmp"
	"context"
	"maps"
	"net/http"
	"slices"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

// Geography is a place as the pickers and addresses show it (C215).
type Geography struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	TypeName    string   `json:"typeName"`
	Level       int      `json:"level"`
	Code        *string  `json:"code"`
	Name        string   `json:"name"`
	ShortName   *string  `json:"shortName"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	HasChildren bool     `json:"hasChildren"`
}

func geography(g store.Geography) Geography {
	return Geography{g.ID, g.Type, g.TypeName, g.Level, g.Code, g.Name, g.ShortName, g.Latitude, g.Longitude, g.HasChildren}
}

// geographies answers a country's places under one parent, or its level 1 without one
// (GET /api/v1/geographies?country=MV&parent=…, C215): one picker's choices, each saying
// whether it has places under it for the next. Cerbos decides first: reference:geography list.
func (m *Module) geographies(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "reference:geography"); err != nil {
			authorization.WriteError(w, r, m.logger, err)
			return
		}
		l, ok := request.ParseList(w, r, store.GeographyListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListGeographies(r.Context(), m.db, l)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing geographies failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]Geography, len(rows))
		for i, g := range rows {
			items[i] = geography(g)
		}
		response.Page(w, r, l, items, total)
	}
}

// PlacePath returns a place and its parents, from level 1 down to it, for showing an
// address (tenancy.Reference); empty when there is no such place.
func (m *Module) PlacePath(ctx context.Context, id string) ([]Geography, error) {
	rows, err := store.PlacePath(ctx, m.db, id)
	if err != nil {
		return nil, err
	}
	path := make([]Geography, len(rows))
	for i, g := range rows {
		path[i] = geography(g)
	}
	return path, nil
}

// CheckAddress checks an address's places against its country's levels (C215), for any
// module's addresses (tenancy.Reference; later HRMS). The place picked (geographyID, ""
// for none) must be current and in country, with no current places under it: a place
// that has them needs one of them. Every level below it that lists no places anywhere in
// the country is typed, and required; typed (by type code) names only those levels. It
// returns a *problem.ValidationError naming geographyId and typedPlaces/<code>, or the
// error that kept it from checking.
func (m *Module) CheckAddress(ctx context.Context, country, geographyID string, typed map[string]string) error {
	var v problem.ValidationError
	ok, err := store.CountryCurrent(ctx, m.db, country)
	if err != nil {
		return err
	}
	if !ok {
		return problem.Invalid("country", "exists", "is not a country in use")
	}
	levels, err := store.CountryAddressLevels(ctx, m.db, country)
	if err != nil {
		return err
	}
	deepest := 0
	if geographyID == "" {
		lists, err := store.CountryListsPlaces(ctx, m.db, country)
		if err != nil {
			return err
		}
		if lists {
			v.Add("geographyId", "required", "is required: the country lists its places")
		}
	} else {
		p, ok, err := store.PlaceByID(ctx, m.db, geographyID)
		switch {
		case err != nil:
			return err
		case !ok || !p.Current:
			v.Add("geographyId", "exists", "is not a place in use")
			return v.Err()
		case p.Country != country:
			v.Add("geographyId", "country", "is not a place of the address's country")
			return v.Err()
		case p.HasChildren:
			v.Add("geographyId", "deeper", "has places under it: pick one of them")
		}
		deepest = p.Level
	}

	// Typed levels: the country's levels below the place picked that list no places.
	typedLevel := map[int][]store.GeographyType{}
	for _, t := range levels.Types {
		if t.Level > deepest && !levels.Listed[t.Level] {
			typedLevel[t.Level] = append(typedLevel[t.Level], t)
		}
	}
	given := map[int]bool{}
	for _, code := range slices.Sorted(maps.Keys(typed)) {
		t, ok := levels.Types[code]
		switch {
		case !ok:
			v.Add("typedPlaces/"+code, "exists", "is not a level of the address's country")
		case t.Level <= deepest || levels.Listed[t.Level]:
			v.Add("typedPlaces/"+code, "excluded", "is not typed: it is picked from the places listed")
		case given[t.Level]:
			v.Add("typedPlaces/"+code, "unique", "names a level already given")
		default:
			given[t.Level] = true
		}
	}
	for _, level := range slices.Sorted(maps.Keys(typedLevel)) {
		if given[level] {
			continue
		}
		types := typedLevel[level]
		slices.SortFunc(types, func(a, b store.GeographyType) int { return cmp.Compare(a.Code, b.Code) })
		v.Add("typedPlaces/"+types[0].Code, "required", "is required: "+types[0].Name+" is typed")
	}
	return v.Err()
}
