# Hermes MCP Configuration — Migration Guide

## Slack MCP Server Migration (2026-04-13)

### Summary

Migrated the Slack MCP server from `@modelcontextprotocol/server-slack` (deprecated) to `slack-mcp-server` (by [korotovsky](https://github.com/korotovsky/slack-mcp-server)).

### Why

- `@modelcontextprotocol/server-slack` is deprecated and no longer maintained.
- `slack-mcp-server` is actively maintained (v1.2.3+), supports Stdio/SSE/HTTP transports, and provides richer functionality including DMs, smart history, message search, and user group management.

### What Changed

**Package:** `@modelcontextprotocol/server-slack` → `slack-mcp-server`

**Environment variables:**

| Old | New | Notes |
|-----|-----|-------|
| `SLACK_BOT_TOKEN` | `SLACK_MCP_XOXB_TOKEN` | Bot token (`xoxb-`) |
| `SLACK_TEAM_ID` | _(not required)_ | Auto-detected on connect |
| `SLACK_APP_TOKEN` | _(removed)_ | Not used by new server |

**Tools (8 → 10):**

Old server tools:
- `slack_list_channels`, `slack_post_message`, `slack_reply_to_thread`, `slack_add_reaction`
- `slack_get_channel_history`, `slack_get_thread_replies`, `slack_get_users`, `slack_get_user_profile`

New server tools:
- `channels_list`, `conversations_history`, `conversations_mark`, `conversations_replies`
- `usergroups_create`, `usergroups_list`, `usergroups_me`, `usergroups_update`, `usergroups_users_update`
- `users_search`

Note: Tool names changed from `slack_*` prefix to domain-based names. Any Hermes skills or workflows referencing old tool names will need updating.

### Configuration

In `~/.hermes/config.yaml`:

```yaml
slack:
  command: npx
  args: ["-y", "slack-mcp-server"]
  env:
    SLACK_MCP_XOXB_TOKEN: "${SLACK_BOT_TOKEN}"
```

The token is read from the `SLACK_BOT_TOKEN` environment variable. Export it in your shell profile:

```sh
# In ~/.zshrc or ~/.bashrc
export SLACK_BOT_TOKEN="xoxb-..."
```

> **Security:** Never commit bot tokens to version control or config files in plaintext. Always use environment variable references.

### Other MCP Changes (same date)

- **Google Workspace:** Changed from non-existent `@anthropic/google-workspace-mcp` to `google-workspace-mcp`. Requires OAuth2 setup — run `npx google-workspace-mcp` once to authenticate.
- **GitHub, Comet, Obsidian:** No changes; all passing connection tests.

### Verification

```sh
hermes mcp test slack    # Should connect and discover 10 tools
hermes mcp list          # Should show all 5 servers enabled
```
