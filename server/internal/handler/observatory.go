package handler

import (
	"encoding/json"
	"math/big"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// ─── Memory Monitor ───────────────────────────────────────────────────────────

type MemoryEntry struct {
	Category  string `json:"category"`
	Text      string `json:"text"`
	CharCount int    `json:"char_count"`
}

type MemoryProfile struct {
	Name       string        `json:"name"`
	Entries    []MemoryEntry `json:"entries"`
	TotalChars int           `json:"total_chars"`
	MaxChars   int           `json:"max_chars"`
}

type MemoryState struct {
	Profiles []MemoryProfile `json:"profiles"`
	ReadAt   string          `json:"read_at"`
}

const (
	memoryMaxChars = 2200
)

func parseMemoryFile(path string) []MemoryEntry {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	lines := strings.Split(string(data), "\n")
	var entries []MemoryEntry
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		cat := classifyMemoryEntry(line)
		entries = append(entries, MemoryEntry{
			Category:  cat,
			Text:      line,
			CharCount: len(line),
		})
	}
	return entries
}

func classifyMemoryEntry(line string) string {
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "error") || strings.Contains(lower, "wrong") || strings.Contains(lower, "don't") || strings.Contains(lower, "never"):
		return "correction"
	case strings.Contains(lower, "prefer") || strings.Contains(lower, "always") || strings.Contains(lower, "like"):
		return "preference"
	case strings.Contains(lower, "todo") || strings.Contains(lower, "task") || strings.Contains(lower, "fix"):
		return "todo"
	case strings.Contains(lower, "project") || strings.Contains(lower, "repo") || strings.Contains(lower, "codebase"):
		return "project"
	case strings.Contains(lower, "env") || strings.Contains(lower, "path") || strings.Contains(lower, "config"):
		return "environment"
	default:
		return "other"
	}
}

func totalChars(entries []MemoryEntry) int {
	n := 0
	for _, e := range entries {
		n += e.CharCount
	}
	return n
}

func (h *Handler) GetObservatoryMemory(w http.ResponseWriter, r *http.Request) {
	hermesDir := os.ExpandEnv("$HOME/.hermes")
	memoriesDir := filepath.Join(hermesDir, "memories")

	dirs, _ := os.ReadDir(memoriesDir)
	profiles := make([]MemoryProfile, 0)

	// Also check the root hermes dir for a single MEMORY.md
	rootMem := parseMemoryFile(filepath.Join(hermesDir, "MEMORY.md"))
	if len(rootMem) > 0 {
		profiles = append(profiles, MemoryProfile{
			Name:       "default",
			Entries:    rootMem,
			TotalChars: totalChars(rootMem),
			MaxChars:   memoryMaxChars,
		})
	}

	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		name := d.Name()
		memPath := filepath.Join(memoriesDir, name, "MEMORY.md")
		entries := parseMemoryFile(memPath)
		if entries == nil {
			// try nested profile dir
			entries = parseMemoryFile(filepath.Join(memoriesDir, name, name, "MEMORY.md"))
		}
		profiles = append(profiles, MemoryProfile{
			Name:       name,
			Entries:    entries,
			TotalChars: totalChars(entries),
			MaxChars:   memoryMaxChars,
		})
	}

	writeJSON(w, http.StatusOK, MemoryState{
		Profiles: profiles,
		ReadAt:   time.Now().UTC().Format(time.RFC3339),
	})
}

// ─── Corrections Tracker ──────────────────────────────────────────────────────

type Correction struct {
	ID          string `json:"id"`
	ActionType  string `json:"action_type"`
	RiskLevel   string `json:"risk_level"`
	DecisionNote string `json:"decision_note"`
	DecidedAt   string `json:"decided_at"`
	AgentName   string `json:"agent_name"`
	IssueTitle  string `json:"issue_title"`
	Severity    string `json:"severity"`
}

func classifyRejectionSeverity(riskLevel, note string) string {
	lower := strings.ToLower(note + " " + riskLevel)
	switch {
	case strings.Contains(lower, "critical") || strings.Contains(lower, "security") ||
		strings.Contains(lower, "data loss") || strings.Contains(lower, "dangerous"):
		return "critical"
	case strings.Contains(lower, "major") || strings.Contains(lower, "significant") ||
		strings.Contains(lower, "high") || strings.Contains(lower, "breaking"):
		return "major"
	default:
		return "minor"
	}
}

func (h *Handler) GetObservatoryCorrections(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	rows, err := h.Queries.GetRejectedApprovals(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch corrections")
		return
	}

	corrections := make([]Correction, 0, len(rows))
	counts := map[string]int{"critical": 0, "major": 0, "minor": 0}

	for _, row := range rows {
		note := ""
		if row.DecisionNote.Valid {
			note = row.DecisionNote.String
		}
		severity := classifyRejectionSeverity(row.RiskLevel, note)
		counts[severity]++

		agentName := ""
		if row.AgentName.Valid {
			agentName = row.AgentName.String
		}
		issueTitle := ""
		if row.IssueTitle.Valid {
			issueTitle = row.IssueTitle.String
		}

		decidedAt := ""
		if row.DecidedAt.Valid {
			decidedAt = row.DecidedAt.Time.UTC().Format(time.RFC3339)
		}

		corrections = append(corrections, Correction{
			ID:           uuidToString(row.ID),
			ActionType:   row.ActionType,
			RiskLevel:    row.RiskLevel,
			DecisionNote: note,
			DecidedAt:    decidedAt,
			AgentName:    agentName,
			IssueTitle:   issueTitle,
			Severity:     severity,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"corrections": corrections,
		"counts":      counts,
		"total":       len(corrections),
	})
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

func (h *Handler) GetObservatoryPatterns(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	wsUUID := parseUUID(workspaceID)

	clusters, err := h.Queries.GetTaskClusters(r.Context(), wsUUID)
	if err != nil {
		clusters = []db.GetTaskClustersRow{}
	}

	repeated, err := h.Queries.GetRepeatedIssueTitles(r.Context(), wsUUID)
	if err != nil {
		repeated = []db.GetRepeatedIssueTitlesRow{}
	}

	heatmap, err := h.Queries.GetHourlyTaskActivity(r.Context(), wsUUID)
	if err != nil {
		heatmap = []db.GetHourlyTaskActivityRow{}
	}

	// Build skill suggestions from repeated prompts with 5+ occurrences
	skillSuggestions := make([]map[string]any, 0)
	for _, rp := range repeated {
		if rp.CouldBeSkill {
			lastSeen := ""
			if t, ok := rp.LastSeen.(time.Time); ok {
				lastSeen = t.UTC().Format(time.RFC3339)
			}
			skillSuggestions = append(skillSuggestions, map[string]any{
				"title":            rp.Title,
				"occurrence_count": rp.OccurrenceCount,
				"last_seen":        lastSeen,
			})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"task_clusters":     clusters,
		"repeated_prompts":  repeated,
		"heatmap":           heatmap,
		"skill_suggestions": skillSuggestions,
	})
}

// ─── Service Health ───────────────────────────────────────────────────────────

type ServiceStatus struct {
	Name    string `json:"name"`
	Running bool   `json:"running"`
	PID     int    `json:"pid,omitempty"`
	Note    string `json:"note,omitempty"`
}

type APIKeyStatus struct {
	Name    string `json:"name"`
	Present bool   `json:"present"`
	Source  string `json:"source"`
}

type DiskInfo struct {
	TotalGB     float64 `json:"total_gb"`
	UsedGB      float64 `json:"used_gb"`
	FreeGB      float64 `json:"free_gb"`
	UsedPercent float64 `json:"used_percent"`
}

type HealthState struct {
	APIKeys   []APIKeyStatus  `json:"api_keys"`
	Services  []ServiceStatus `json:"services"`
	Disk      *DiskInfo       `json:"disk"`
	MemoryMB  map[string]uint64 `json:"memory_mb"`
	GoVersion string          `json:"go_version"`
	OS        string          `json:"os"`
	ReadAt    string          `json:"read_at"`
}

func checkPID(processName string) (bool, int) {
	out, err := exec.Command("pgrep", "-n", processName).Output()
	if err != nil {
		return false, 0
	}
	pidStr := strings.TrimSpace(string(out))
	pid, err := strconv.Atoi(pidStr)
	if err != nil {
		return false, 0
	}
	return true, pid
}

// checkDockerContainer checks if a Docker container with the given name substring is running.
func checkDockerContainer(nameSubstr string) (bool, string) {
	out, err := exec.Command("docker", "ps", "--filter", "name="+nameSubstr, "--format", "{{.Names}}").Output()
	if err != nil {
		return false, ""
	}
	name := strings.TrimSpace(string(out))
	return name != "", name
}

// checkDaemonPID checks if the multica daemon is running via its PID file.
func checkDaemonPID() (bool, int) {
	home, err := os.UserHomeDir()
	if err != nil {
		return false, 0
	}
	data, err := os.ReadFile(filepath.Join(home, ".multica", "daemon.pid"))
	if err != nil {
		return false, 0
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return false, 0
	}
	// Check if process is actually running
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false, 0
	}
	// On Unix, FindProcess always succeeds. Send signal 0 to check if alive.
	if err := proc.Signal(syscall.Signal(0)); err != nil {
		return false, 0
	}
	return true, pid
}

func getDiskInfo() *DiskInfo {
	if runtime.GOOS == "darwin" {
		out, err := exec.Command("df", "-k", "/").Output()
		if err != nil {
			return nil
		}
		lines := strings.Split(string(out), "\n")
		if len(lines) < 2 {
			return nil
		}
		fields := strings.Fields(lines[1])
		if len(fields) < 5 {
			return nil
		}
		total, _ := strconv.ParseFloat(fields[1], 64)
		used, _ := strconv.ParseFloat(fields[2], 64)
		free, _ := strconv.ParseFloat(fields[3], 64)
		return &DiskInfo{
			TotalGB:     total / 1024 / 1024,
			UsedGB:      used / 1024 / 1024,
			FreeGB:      free / 1024 / 1024,
			UsedPercent: (used / total) * 100,
		}
	}
	return nil
}

// loadHermesConfigKeys reads ~/.hermes/config.yaml and returns a set of env var
// names that have non-empty values (either hardcoded or referencing set env vars).
func loadHermesConfigKeys() map[string]bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(home, ".hermes", "config.yaml"))
	if err != nil {
		return nil
	}
	// Simple scan: find lines with known env var patterns
	keys := make(map[string]bool)
	content := string(data)
	// Check for hardcoded GitHub token
	if strings.Contains(content, "ghp_") || strings.Contains(content, "github_pat_") {
		keys["GITHUB_TOKEN"] = true
	}
	// Check for hardcoded or env-referenced Slack token
	if strings.Contains(content, "xoxb-") {
		keys["SLACK_BOT_TOKEN"] = true
	} else if strings.Contains(content, "SLACK_BOT_TOKEN") || strings.Contains(content, "SLACK_MCP_XOXB_TOKEN") {
		// Referenced via ${...} — check if the env var is actually set
		if os.Getenv("SLACK_BOT_TOKEN") != "" || os.Getenv("SLACK_MCP_XOXB_TOKEN") != "" {
			keys["SLACK_BOT_TOKEN"] = true
		}
	}
	// Comet/Perplexity (comet-mcp is configured = API likely works)
	if strings.Contains(content, "comet-mcp") {
		keys["PPLX_API_KEY"] = true
	}
	// Google workspace
	if strings.Contains(content, "google-workspace-mcp") {
		keys["GLM_API_KEY"] = true
	}
	return keys
}

func (h *Handler) GetObservatoryHealth(w http.ResponseWriter, _ *http.Request) {
	// Check API keys in both env vars AND ~/.hermes/config.yaml
	hermesKeys := loadHermesConfigKeys()

	type keyCheck struct {
		name    string
		aliases []string // alternative env var names to check
	}
	checks := []keyCheck{
		{name: "GITHUB_TOKEN", aliases: []string{"GITHUB_PERSONAL_ACCESS_TOKEN"}},
		{name: "SLACK_BOT_TOKEN", aliases: []string{"SLACK_MCP_XOXB_TOKEN"}},
		{name: "PPLX_API_KEY"},
		{name: "GLM_API_KEY", aliases: []string{"GOOGLE_CLIENT_ID"}},
	}

	apiKeys := make([]APIKeyStatus, 0, len(checks))
	for _, check := range checks {
		present := false
		source := "not found"

		// Check primary env var
		if os.Getenv(check.name) != "" {
			present = true
			source = "env"
		}
		// Check aliases
		if !present {
			for _, alias := range check.aliases {
				if os.Getenv(alias) != "" {
					present = true
					source = "env (" + alias + ")"
					break
				}
			}
		}
		// Check hermes config
		if !present && hermesKeys[check.name] {
			present = true
			source = "~/.hermes/config.yaml"
		}

		apiKeys = append(apiKeys, APIKeyStatus{
			Name:    check.name,
			Present: present,
			Source:  source,
		})
	}

	services := make([]ServiceStatus, 0, 3)

	// Docker
	dockerRunning, _ := checkPID("docker")
	services = append(services, ServiceStatus{Name: "docker", Running: dockerRunning})

	// PostgreSQL — detect via Docker container, not local process
	pgRunning, pgName := checkDockerContainer("postgres")
	pgNote := ""
	if pgRunning {
		pgNote = "container: " + pgName
	}
	services = append(services, ServiceStatus{Name: "postgres", Running: pgRunning, Note: pgNote})

	// Hermes daemon — detect via multica daemon PID file
	daemonRunning, daemonPID := checkDaemonPID()
	daemonNote := ""
	if daemonRunning {
		daemonNote = "multica daemon"
	}
	services = append(services, ServiceStatus{Name: "hermes", Running: daemonRunning, PID: daemonPID, Note: daemonNote})

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	writeJSON(w, http.StatusOK, HealthState{
		APIKeys:  apiKeys,
		Services: services,
		Disk:     getDiskInfo(),
		MemoryMB: map[string]uint64{
			"alloc":       memStats.Alloc / 1024 / 1024,
			"total_alloc": memStats.TotalAlloc / 1024 / 1024,
			"sys":         memStats.Sys / 1024 / 1024,
		},
		GoVersion: runtime.Version(),
		OS:        runtime.GOOS + "/" + runtime.GOARCH,
		ReadAt:    time.Now().UTC().Format(time.RFC3339),
	})
}

// ─── Agent Profiles ───────────────────────────────────────────────────────────

type AgentProfile struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Status         string  `json:"status"`
	Model          string  `json:"model"`
	Provider       string  `json:"provider"`
	TotalTasks     int32   `json:"total_tasks"`
	CompletedTasks int32   `json:"completed_tasks"`
	FailedTasks    int32   `json:"failed_tasks"`
	TotalTokens    int64   `json:"total_tokens"`
	TotalCostUSD   float64 `json:"total_cost_usd"`
	LastActive     string  `json:"last_active"`
}

func extractRuntimeConfigField(configBytes []byte, field string) string {
	var cfg map[string]any
	if err := json.Unmarshal(configBytes, &cfg); err != nil {
		return ""
	}
	if v, ok := cfg[field]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func (h *Handler) GetObservatoryProfiles(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	rows, err := h.Queries.GetAgentStats(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch agent profiles")
		return
	}

	profiles := make([]AgentProfile, 0, len(rows))
	for _, row := range rows {
		costFloat := 0.0
		if row.TotalCostUsd.Valid {
			f, _ := row.TotalCostUsd.Float64Value()
			costFloat = f.Float64
		}

		lastActive := ""
		if t, ok := row.LastActive.(time.Time); ok {
			lastActive = t.UTC().Format(time.RFC3339)
		}

		model := extractRuntimeConfigField(row.RuntimeConfig, "model")
		provider := extractRuntimeConfigField(row.RuntimeConfig, "provider")

		profiles = append(profiles, AgentProfile{
			ID:             uuidToString(row.ID),
			Name:           row.Name,
			Status:         row.Status,
			Model:          model,
			Provider:       provider,
			TotalTasks:     row.TotalTasks,
			CompletedTasks: row.CompletedTasks,
			FailedTasks:    row.FailedTasks,
			TotalTokens:    row.TotalTokens,
			TotalCostUSD:   costFloat,
			LastActive:     lastActive,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"profiles": profiles})
}

// ─── Session History ──────────────────────────────────────────────────────────

type SessionEntry struct {
	TaskID          string  `json:"task_id"`
	IssueID         string  `json:"issue_id"`
	IssueTitle      string  `json:"issue_title"`
	AgentName       string  `json:"agent_name"`
	Status          string  `json:"status"`
	CreatedAt       string  `json:"created_at"`
	StartedAt       string  `json:"started_at,omitempty"`
	CompletedAt     string  `json:"completed_at,omitempty"`
	InputTokens     int32   `json:"input_tokens"`
	OutputTokens    int32   `json:"output_tokens"`
	CacheReadTokens int32   `json:"cache_read_tokens"`
	CacheWriteTokens int32  `json:"cache_write_tokens"`
	TotalTokens     int32   `json:"total_tokens"`
	CostUSD         float64 `json:"cost_usd"`
	Model           string  `json:"model"`
}

func (h *Handler) GetObservatorySessions(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	wsUUID := parseUUID(workspaceID)

	limit := int32(50)
	offset := int32(0)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = int32(n)
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil {
			offset = int32(n)
		}
	}

	rows, err := h.Queries.GetSessionHistory(r.Context(), db.GetSessionHistoryParams{
		WorkspaceID: wsUUID,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch sessions")
		return
	}

	dailyStats, err := h.Queries.GetDailySessionStats(r.Context(), wsUUID)
	if err != nil {
		dailyStats = nil
	}

	sessions := make([]SessionEntry, 0, len(rows))
	for _, row := range rows {
		costFloat := 0.0
		if row.CostUsd.Valid {
			n := row.CostUsd.Int
			exp := row.CostUsd.Exp
			f, _ := new(big.Float).SetInt(n).Float64()
			for exp < 0 {
				f /= 10
				exp++
			}
			costFloat = f
		}

		startedAt := ""
		if row.StartedAt.Valid {
			startedAt = row.StartedAt.Time.UTC().Format(time.RFC3339)
		}
		completedAt := ""
		if row.CompletedAt.Valid {
			completedAt = row.CompletedAt.Time.UTC().Format(time.RFC3339)
		}

		sessions = append(sessions, SessionEntry{
			TaskID:           uuidToString(row.TaskID),
			IssueID:          uuidToString(row.IssueID),
			IssueTitle:       row.IssueTitle,
			AgentName:        row.AgentName,
			Status:           row.Status,
			CreatedAt:        row.CreatedAt.Time.UTC().Format(time.RFC3339),
			StartedAt:        startedAt,
			CompletedAt:      completedAt,
			InputTokens:      row.InputTokens,
			OutputTokens:     row.OutputTokens,
			CacheReadTokens:  row.CacheReadTokens,
			CacheWriteTokens: row.CacheWriteTokens,
			TotalTokens:      row.InputTokens + row.OutputTokens + row.CacheReadTokens,
			CostUSD:          costFloat,
			Model:            row.Model,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"sessions":    sessions,
		"daily_stats": dailyStats,
	})
}
