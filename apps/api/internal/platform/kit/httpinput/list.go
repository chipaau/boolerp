package httpinput

import (
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// ListSpec declares what a list endpoint accepts (C68, C69): its sort fields, its
// default sort, and its filters with their allowed values. Anything not declared is
// refused, so nothing reaches SQL that was not declared. No maintained Go library
// parses this contract (page, pageSize, q, sort, named filters) with these errors;
// chi and the standard library give only the raw query (a recorded gap).
type ListSpec struct {
	Sorts       []string            // fields sort may name, such as "name", "createdAt"
	DefaultSort string              // such as "name" or "-createdAt"
	Filters     map[string][]string // filter name → allowed values (nil: any non-blank value)
	Search      bool                // whether q is accepted
}

// The page size limits (C68).
const (
	DefaultPageSize = 25
	MaxPageSize     = 100
	maxSearch       = 100
)

// List is a parsed list request.
type List struct {
	Page, PageSize int
	Q              string
	Sort           []SortField
	Filters        map[string]string
}

// SortField is one sort key, in order.
type SortField struct {
	Field string
	Desc  bool
}

// Offset is the row offset of the page.
func (l List) Offset() int { return (l.Page - 1) * l.PageSize }

// ParseList reads r's list parameters against spec. On failure it writes a 422
// validation problem naming each bad parameter and returns false.
func ParseList(w http.ResponseWriter, r *http.Request, spec ListSpec) (List, bool) {
	l, errs := parseList(r.URL.Query(), spec)
	if len(errs) > 0 {
		problem.WriteValidation(w, r, errs)
		return List{}, false
	}
	return l, true
}

func parseList(q url.Values, spec ListSpec) (List, []problem.FieldError) {
	l := List{Page: 1, PageSize: DefaultPageSize, Filters: map[string]string{}}
	var errs []problem.FieldError
	bad := func(param, code, detail string) {
		errs = append(errs, problem.FieldError{Parameter: param, Code: code, Detail: detail})
	}

	names := make([]string, 0, len(q))
	for name := range q {
		names = append(names, name)
	}
	slices.Sort(names) // a stable order of errors
	for _, name := range names {
		values := q[name]
		if len(values) > 1 {
			bad(name, "multiple", "must be given once")
			continue
		}
		v := values[0]
		switch name {
		case "page":
			n, err := strconv.Atoi(v)
			if err != nil || n < 1 {
				bad(name, "min", "must be a whole number of at least 1")
				continue
			}
			l.Page = n
		case "pageSize":
			n, err := strconv.Atoi(v)
			switch {
			case err != nil || n < 1:
				bad(name, "min", "must be a whole number of at least 1")
			case n > MaxPageSize:
				bad(name, "max", "must be at most "+strconv.Itoa(MaxPageSize))
			default:
				l.PageSize = n
			}
		case "q":
			if !spec.Search {
				bad(name, "unknown", "is not a parameter of this list")
				continue
			}
			v = strings.TrimSpace(v)
			if utf8.RuneCountInString(v) > maxSearch {
				bad(name, "max", "must be at most "+strconv.Itoa(maxSearch)+" characters")
				continue
			}
			l.Q = v
		case "sort":
			fields, ok := parseSort(v, spec.Sorts)
			if !ok {
				bad(name, "oneof", "must be a comma-separated list of: "+strings.Join(spec.Sorts, ", ")+
					" (each optionally prefixed with -)")
				continue
			}
			l.Sort = fields
		default:
			allowed, declared := spec.Filters[name]
			switch {
			case !declared:
				bad(name, "unknown", "is not a parameter of this list")
			case strings.TrimSpace(v) == "":
				bad(name, "required", "must not be blank")
			case allowed != nil && !slices.Contains(allowed, v):
				bad(name, "oneof", "must be one of: "+strings.Join(allowed, ", "))
			default:
				l.Filters[name] = v
			}
		}
	}
	if l.Sort == nil {
		l.Sort, _ = parseSort(spec.DefaultSort, spec.Sorts)
	}
	return l, errs
}

// parseSort reads "a,-b" against the allowed fields; each field at most once.
func parseSort(v string, allowed []string) ([]SortField, bool) {
	if v == "" {
		return nil, false
	}
	var fields []SortField
	seen := map[string]bool{}
	for part := range strings.SplitSeq(v, ",") {
		f := SortField{Field: part}
		if rest, ok := strings.CutPrefix(part, "-"); ok {
			f = SortField{Field: rest, Desc: true}
		}
		if !slices.Contains(allowed, f.Field) || seen[f.Field] {
			return nil, false
		}
		seen[f.Field] = true
		fields = append(fields, f)
	}
	return fields, true
}

// Escape escapes a search term for SQL LIKE (\ is the escape character), so % and _
// in what a person typed match themselves.
func Escape(q string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
}
