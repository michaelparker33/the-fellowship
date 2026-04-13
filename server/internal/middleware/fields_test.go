package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// jsonHandler returns a handler that writes the given JSON string.
func jsonHandler(body string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(body))
	})
}

func TestFieldSelection_NoParam_Passthrough(t *testing.T) {
	body := `{"id":"1","title":"Test","description":"Long text","status":"open"}`
	handler := FieldSelection(jsonHandler(body))

	req := httptest.NewRequest("GET", "/api/issues", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result) != 4 {
		t.Fatalf("expected 4 fields, got %d", len(result))
	}
}

func TestFieldSelection_FieldsParam_FiltersObject(t *testing.T) {
	body := `{"id":"1","title":"Test","description":"Long text","status":"open"}`
	handler := FieldSelection(jsonHandler(body))

	req := httptest.NewRequest("GET", "/api/issues/1?fields=title,status", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	// Should have id (always included), title, status
	if _, ok := result["id"]; !ok {
		t.Error("expected id to always be included")
	}
	if _, ok := result["title"]; !ok {
		t.Error("expected title to be included")
	}
	if _, ok := result["status"]; !ok {
		t.Error("expected status to be included")
	}
	if _, ok := result["description"]; ok {
		t.Error("expected description to be excluded")
	}
}

func TestFieldSelection_AlwaysIncludesID(t *testing.T) {
	body := `{"id":"1","title":"Test","description":"Long text"}`
	handler := FieldSelection(jsonHandler(body))

	// Request only title — id should still be included
	req := httptest.NewRequest("GET", "/api/issues/1?fields=title", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	if _, ok := result["id"]; !ok {
		t.Error("expected id to always be included even when not in fields param")
	}
	if _, ok := result["title"]; !ok {
		t.Error("expected title to be included")
	}
	if len(result) != 2 {
		t.Errorf("expected 2 fields (id, title), got %d", len(result))
	}
}

func TestFieldSelection_EnvelopeFiltering(t *testing.T) {
	body := `{"issues":[{"id":"1","title":"A","description":"Long"},{"id":"2","title":"B","description":"Also long"}],"total":2}`
	handler := FieldSelection(jsonHandler(body))

	req := httptest.NewRequest("GET", "/api/issues?fields=id,title", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	// total should be preserved
	if result["total"] == nil {
		t.Error("expected total to be preserved in envelope")
	}

	issues, ok := result["issues"].([]interface{})
	if !ok {
		t.Fatal("expected issues to be an array")
	}
	if len(issues) != 2 {
		t.Fatalf("expected 2 issues, got %d", len(issues))
	}

	first := issues[0].(map[string]interface{})
	if _, ok := first["id"]; !ok {
		t.Error("expected id in filtered issue")
	}
	if _, ok := first["title"]; !ok {
		t.Error("expected title in filtered issue")
	}
	if _, ok := first["description"]; ok {
		t.Error("expected description to be excluded from filtered issue")
	}
}

func TestFieldSelection_ExcludeParam(t *testing.T) {
	body := `{"id":"1","title":"Test","description":"Very long text","action_payload":"huge json blob"}`
	handler := FieldSelection(jsonHandler(body))

	req := httptest.NewRequest("GET", "/api/issues/1?exclude=description,action_payload", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	if _, ok := result["id"]; !ok {
		t.Error("expected id to be present")
	}
	if _, ok := result["title"]; !ok {
		t.Error("expected title to be present")
	}
	if _, ok := result["description"]; ok {
		t.Error("expected description to be excluded")
	}
	if _, ok := result["action_payload"]; ok {
		t.Error("expected action_payload to be excluded")
	}
}

func TestFieldSelection_NonJSON_Passthrough(t *testing.T) {
	plainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("hello world"))
	})
	handler := FieldSelection(plainHandler)

	req := httptest.NewRequest("GET", "/api/something?fields=id,title", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Body.String() != "hello world" {
		t.Errorf("expected passthrough for non-JSON, got %q", rec.Body.String())
	}
}

func TestFieldSelection_ArrayResponse(t *testing.T) {
	body := `[{"id":"1","title":"A","description":"x"},{"id":"2","title":"B","description":"y"}]`
	handler := FieldSelection(jsonHandler(body))

	req := httptest.NewRequest("GET", "/api/something?fields=title", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var result []map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	if len(result) != 2 {
		t.Fatalf("expected 2 items, got %d", len(result))
	}
	for _, item := range result {
		if _, ok := item["id"]; !ok {
			t.Error("expected id in every item")
		}
		if _, ok := item["title"]; !ok {
			t.Error("expected title in every item")
		}
		if _, ok := item["description"]; ok {
			t.Error("expected description excluded")
		}
	}
}

func TestFieldSelection_XResponseFieldsHeader(t *testing.T) {
	body := `{"id":"1","title":"Test","status":"open"}`
	handler := FieldSelection(jsonHandler(body))

	req := httptest.NewRequest("GET", "/api/issues/1?fields=title,status", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	header := rec.Header().Get("X-Response-Fields")
	if header == "" {
		t.Error("expected X-Response-Fields header to be set")
	}
	// Should contain id, title, status (order may vary)
	for _, expected := range []string{"id", "title", "status"} {
		found := false
		for _, f := range splitCSV(header) {
			if f == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected %q in X-Response-Fields header, got %q", expected, header)
		}
	}
}

func TestFieldSelection_EmptyBody(t *testing.T) {
	emptyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNoContent)
	})
	handler := FieldSelection(emptyHandler)

	req := httptest.NewRequest("GET", "/api/something?fields=id", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestFieldSelection_PreservesStatusCode(t *testing.T) {
	notFoundHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":"not found"}`))
	})
	handler := FieldSelection(notFoundHandler)

	req := httptest.NewRequest("GET", "/api/issues/bad?fields=id", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func splitCSV(s string) []string {
	parts := make([]string, 0)
	for _, p := range splitString(s, ",") {
		p = trimSpace(p)
		if p != "" {
			parts = append(parts, p)
		}
	}
	return parts
}

func splitString(s, sep string) []string {
	result := make([]string, 0)
	for {
		idx := indexString(s, sep)
		if idx < 0 {
			result = append(result, s)
			break
		}
		result = append(result, s[:idx])
		s = s[idx+len(sep):]
	}
	return result
}

func indexString(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
