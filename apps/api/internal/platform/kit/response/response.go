// Package response writes the API's success responses (C209): every one goes through
// here, as JSON by go-chi/render, and every error through package problem. Each function
// fixes part of the contract: a create always carries Location, a delete has no body, and
// a list always uses the page envelope (C68). Redirects, files, and proxied responses use
// the standard library instead.
package response

import (
	"net/http"

	"github.com/go-chi/render"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// OK answers 200 with v as JSON: a resource shown, or changed and shown again.
func OK(w http.ResponseWriter, r *http.Request, v any) {
	render.JSON(w, r, v)
}

// Created answers 201 with v, the new resource, as JSON, and its address in Location.
func Created(w http.ResponseWriter, r *http.Request, location string, v any) {
	w.Header().Set("Location", location)
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, v)
}

// NoContent answers 204 with no body: a delete, or an action with nothing to show.
func NoContent(w http.ResponseWriter, r *http.Request) {
	render.NoContent(w, r)
}

// Paged is one page of a list in the agreed envelope (C68): the items, which page it
// is, its size, and how many items match in all.
type Paged[T any] struct {
	Items    []T `json:"items"`
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
	Total    int `json:"total"`
}

// Page answers l's page: 200 with items in the envelope, an empty array (never null)
// when there are none, and total, how many items match in all.
func Page[T any](w http.ResponseWriter, r *http.Request, l request.List, items []T, total int) {
	if items == nil {
		items = []T{}
	}
	render.JSON(w, r, Paged[T]{Items: items, Page: l.Page, PageSize: l.PageSize, Total: total})
}
