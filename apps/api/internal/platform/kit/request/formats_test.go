package request

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// The shared formats (C208) and a module's struct-level rules, through Decode.

type formats struct {
	Phone    string   `json:"phone" validate:"omitempty,phone"`
	Slug     string   `json:"slug" validate:"omitempty,slug"`
	Name     string   `json:"name" validate:"omitempty,notblank"`
	Timezone string   `json:"timezone" validate:"omitempty,timezone"`
	Date     string   `json:"date" validate:"omitempty,datetime=2006-01-02"`
	Code     string   `json:"code" validate:"omitempty,uppercase"`
	Key      string   `json:"key" validate:"omitempty,alphanum"`
	Tags     []string `json:"tags"`
}

func init() {
	RegisterStructValidation(func(sl validator.StructLevel) {
		f := sl.Current().Interface().(formats)
		if f.Slug == "admin" {
			sl.ReportError(f.Slug, "slug", "Slug", "reserved", "")
		}
		if len(f.Tags) > 2 {
			sl.ReportError(f.Tags, "tags", "Tags", "primary", "")
		}
		for i, tag := range f.Tags {
			if i > 0 && tag == f.Tags[i-1] {
				sl.ReportError(tag, "tags[1]", "Tags", "unique", "")
			}
		}
	}, formats{})
}

func decodeFormats(t *testing.T, body string) (bool, map[string]problem.FieldError) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	var dst formats
	if Decode(rec, req, &dst) {
		return true, nil
	}
	errs := map[string]problem.FieldError{}
	for _, e := range problemOf(t, rec).Errors {
		errs[e.Pointer] = e
	}
	return false, errs
}

func TestTheSharedFormatsAcceptWhatTheTablesDo(t *testing.T) {
	ok, errs := decodeFormats(t, `{"phone":"+9603324568","slug":"9lives-clinic","name":"Clinic","timezone":"Indian/Maldives"}`)
	assert.True(t, ok, errs)
}

func TestTheSharedFormatsNameEachFailure(t *testing.T) {
	ok, errs := decodeFormats(t, `{"phone":"3324568","slug":"-Bad_","name":"   ","timezone":"Local"}`)
	require.False(t, ok)
	for pointer, code := range map[string]string{"#/phone": "phone", "#/slug": "slug", "#/name": "notblank", "#/timezone": "timezone"} {
		assert.Equal(t, code, errs[pointer].Code, pointer)
		assert.NotContains(t, errs[pointer].Detail, "fails the", "every shared format has its own message")
	}
}

func TestAStructLevelRuleReportsOnItsField(t *testing.T) {
	ok, errs := decodeFormats(t, `{"slug":"admin","tags":["a","a"]}`)
	require.False(t, ok)
	assert.Equal(t, problem.FieldError{Pointer: "#/slug", Code: "reserved", Detail: "is a name the platform uses"}, errs["#/slug"])
	assert.Equal(t, problem.FieldError{Pointer: "#/tags/1", Code: "unique", Detail: "is listed twice"}, errs["#/tags/1"])
}

func TestEveryRuleHasAMessage(t *testing.T) {
	ok, errs := decodeFormats(t, `{"date":"15/01/2026","code":"abc","key":"a-b","tags":["a","b","c"]}`)
	require.False(t, ok)
	for _, pointer := range []string{"#/date", "#/code", "#/key", "#/tags"} {
		require.Contains(t, errs, pointer)
		assert.NotContains(t, errs[pointer].Detail, "fails the", pointer)
	}
	assert.Equal(t, "must be a date in the form 2006-01-02", errs["#/date"].Detail)
}
