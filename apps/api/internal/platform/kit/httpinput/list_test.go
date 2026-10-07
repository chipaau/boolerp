package httpinput

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

var spec = ListSpec{
	Sorts:       []string{"name", "createdAt"},
	DefaultSort: "name",
	Filters:     map[string][]string{"status": {"active", "suspended"}, "country": nil},
	Search:      true,
}

func TestParseListDefaults(t *testing.T) {
	l, errs := parseList(url.Values{}, spec)
	require.Empty(t, errs)
	assert.Equal(t, List{Page: 1, PageSize: DefaultPageSize, Sort: []SortField{{Field: "name"}}, Filters: map[string]string{}}, l)
	assert.Zero(t, l.Offset())
}

func TestParseListReadsEveryParameter(t *testing.T) {
	q, _ := url.ParseQuery("page=3&pageSize=50&q=+cyryx+&sort=-createdAt,name&status=active&country=MV")
	l, errs := parseList(q, spec)
	require.Empty(t, errs)
	assert.Equal(t, 3, l.Page)
	assert.Equal(t, 50, l.PageSize)
	assert.Equal(t, 100, l.Offset())
	assert.Equal(t, "cyryx", l.Q, "trimmed")
	assert.Equal(t, []SortField{{Field: "createdAt", Desc: true}, {Field: "name"}}, l.Sort)
	assert.Equal(t, map[string]string{"status": "active", "country": "MV"}, l.Filters)
}

func TestParseListRefusesWhatIsNotDeclared(t *testing.T) {
	for raw, want := range map[string]problem.FieldError{
		"page=0":            {Parameter: "page", Code: "min"},
		"page=x":            {Parameter: "page", Code: "min"},
		"pageSize=101":      {Parameter: "pageSize", Code: "max"},
		"pageSize=0":        {Parameter: "pageSize", Code: "min"},
		"sort=slug":         {Parameter: "sort", Code: "oneof"},
		"sort=name,-name":   {Parameter: "sort", Code: "oneof"},
		"sort=":             {Parameter: "sort", Code: "oneof"},
		"status=gone":       {Parameter: "status", Code: "oneof"},
		"country=+":         {Parameter: "country", Code: "required"},
		"tenantId=x":        {Parameter: "tenantId", Code: "unknown"},
		"page=1&page=2":     {Parameter: "page", Code: "multiple"},
		"q=" + longSearch(): {Parameter: "q", Code: "max"},
	} {
		q, _ := url.ParseQuery(raw)
		_, errs := parseList(q, spec)
		require.Len(t, errs, 1, raw)
		assert.Equal(t, want.Parameter, errs[0].Parameter, raw)
		assert.Equal(t, want.Code, errs[0].Code, raw)
		assert.NotEmpty(t, errs[0].Detail, raw)
	}

	noSearch := spec
	noSearch.Search = false
	_, errs := parseList(url.Values{"q": {"x"}}, noSearch)
	require.Len(t, errs, 1)
	assert.Equal(t, "unknown", errs[0].Code)
}

func longSearch() string {
	b := make([]byte, 101)
	for i := range b {
		b[i] = 'a'
	}
	return string(b)
}

func TestParseListWritesOneProblemForEveryBadParameter(t *testing.T) {
	rec := httptest.NewRecorder()
	_, ok := ParseList(rec, httptest.NewRequest(http.MethodGet, "/x?page=0&pageSize=500&secret=s3cret", nil), spec)
	assert.False(t, ok)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	var body problem.Details
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
	assert.Equal(t, problem.TypeValidation, body.Type)
	require.Len(t, body.Errors, 3)
	assert.Equal(t, []string{"page", "pageSize", "secret"},
		[]string{body.Errors[0].Parameter, body.Errors[1].Parameter, body.Errors[2].Parameter})
	assert.NotContains(t, rec.Body.String(), "s3cret", "values are never echoed")

	l, ok := ParseList(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/x?page=2", nil), spec)
	assert.True(t, ok)
	assert.Equal(t, 2, l.Page)
}

func TestEscape(t *testing.T) {
	assert.Equal(t, `50\% off\_now \\`, Escape(`50% off_now \`))
}
