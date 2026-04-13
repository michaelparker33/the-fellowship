package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
)

// knownEnvelopeKeys are the JSON keys that contain arrays of objects in
// envelope-style responses. Field filtering applies to items inside these arrays.
var knownEnvelopeKeys = map[string]bool{
	"issues":     true,
	"projects":   true,
	"agents":     true,
	"goals":      true,
	"brain_dumps": true,
	"missions":   true,
	"approvals":  true,
	"members":    true,
	"comments":   true,
	"tasks":      true,
	"skills":     true,
	"items":      true,
}

// FieldSelection is an HTTP middleware that filters JSON response bodies based
// on the `fields` or `exclude` query parameters. This enables clients (especially
// AI agents) to request only the fields they need, reducing token usage.
//
// Usage:
//
//	GET /api/issues?fields=id,title,status          — include only these fields
//	GET /api/issues?exclude=description,action_payload — exclude heavy fields
//
// The `id` field is always included even if not specified. When filtering is
// applied, an X-Response-Fields header lists the included fields.
func FieldSelection(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fieldsParam := r.URL.Query().Get("fields")
		excludeParam := r.URL.Query().Get("exclude")

		if fieldsParam == "" && excludeParam == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Capture the response
		capture := &responseCapture{
			ResponseWriter: w,
			body:           &bytes.Buffer{},
			statusCode:     200,
			headerWritten:  false,
		}
		next.ServeHTTP(capture, r)

		// Only filter JSON responses
		contentType := capture.Header().Get("Content-Type")
		if !strings.Contains(contentType, "application/json") {
			w.WriteHeader(capture.statusCode)
			w.Write(capture.body.Bytes())
			return
		}

		raw := capture.body.Bytes()
		if len(raw) == 0 {
			w.WriteHeader(capture.statusCode)
			return
		}

		var filtered []byte
		var appliedFields []string

		if fieldsParam != "" {
			fields := parseFieldSet(fieldsParam)
			// Always include id
			fields["id"] = true
			filtered = filterJSON(raw, fields, false)
			appliedFields = fieldSetToSlice(fields)
		} else {
			excludes := parseFieldSet(excludeParam)
			filtered = filterJSON(raw, excludes, true)
		}

		if appliedFields != nil {
			w.Header().Set("X-Response-Fields", strings.Join(appliedFields, ","))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", "")
		w.WriteHeader(capture.statusCode)
		w.Write(filtered)
	})
}

// responseCapture wraps an http.ResponseWriter to capture the response body
// and status code without writing to the underlying writer.
type responseCapture struct {
	http.ResponseWriter
	body          *bytes.Buffer
	statusCode    int
	headerWritten bool
}

func (rc *responseCapture) WriteHeader(code int) {
	rc.statusCode = code
	rc.headerWritten = true
	// Don't write to the underlying writer yet — we need to filter first.
}

func (rc *responseCapture) Write(b []byte) (int, error) {
	if !rc.headerWritten {
		rc.statusCode = 200
		rc.headerWritten = true
	}
	return rc.body.Write(b)
}

// parseFieldSet splits a comma-separated field list into a set.
func parseFieldSet(param string) map[string]bool {
	fields := make(map[string]bool)
	for _, f := range strings.Split(param, ",") {
		f = strings.TrimSpace(f)
		if f != "" {
			fields[f] = true
		}
	}
	return fields
}

// fieldSetToSlice converts a field set to a sorted slice for headers.
func fieldSetToSlice(fields map[string]bool) []string {
	result := make([]string, 0, len(fields))
	for f := range fields {
		result = append(result, f)
	}
	return result
}

// filterJSON filters a JSON byte slice, keeping or excluding the specified fields.
// If exclude is true, the fieldSet contains fields to remove; otherwise it contains
// fields to keep.
func filterJSON(data []byte, fieldSet map[string]bool, exclude bool) []byte {
	// Try as object first
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err == nil {
		filtered := filterObject(obj, fieldSet, exclude)
		result, err := json.Marshal(filtered)
		if err != nil {
			return data
		}
		return result
	}

	// Try as array
	var arr []interface{}
	if err := json.Unmarshal(data, &arr); err == nil {
		filtered := filterArray(arr, fieldSet, exclude)
		result, err := json.Marshal(filtered)
		if err != nil {
			return data
		}
		return result
	}

	// Not JSON we can filter — return as-is
	return data
}

// filterObject handles a JSON object. If it looks like an envelope response
// (has a known key pointing to an array), it filters the array items inside
// and preserves the other top-level keys (e.g. "total").
func filterObject(obj map[string]interface{}, fieldSet map[string]bool, exclude bool) map[string]interface{} {
	// Check for envelope pattern: a top-level key matching a known envelope key
	// whose value is an array.
	for key := range obj {
		if knownEnvelopeKeys[key] {
			if arr, ok := obj[key].([]interface{}); ok {
				result := make(map[string]interface{})
				// Copy all top-level keys as-is
				for k, v := range obj {
					result[k] = v
				}
				// Replace the envelope array with filtered items
				result[key] = filterArray(arr, fieldSet, exclude)
				return result
			}
		}
	}

	// Plain object — filter its fields directly
	return filterFields(obj, fieldSet, exclude)
}

// filterArray applies field filtering to each object in an array.
func filterArray(arr []interface{}, fieldSet map[string]bool, exclude bool) []interface{} {
	result := make([]interface{}, len(arr))
	for i, item := range arr {
		if obj, ok := item.(map[string]interface{}); ok {
			result[i] = filterFields(obj, fieldSet, exclude)
		} else {
			result[i] = item
		}
	}
	return result
}

// filterFields filters individual object fields.
// If exclude is false, keeps only fields in the set.
// If exclude is true, keeps all fields except those in the set.
func filterFields(obj map[string]interface{}, fieldSet map[string]bool, exclude bool) map[string]interface{} {
	result := make(map[string]interface{})
	if exclude {
		for k, v := range obj {
			if !fieldSet[k] {
				result[k] = v
			}
		}
	} else {
		for k, v := range obj {
			if fieldSet[k] {
				result[k] = v
			}
		}
	}
	return result
}
