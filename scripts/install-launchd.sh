#!/usr/bin/env bash
#
# install-launchd.sh — Install/uninstall The Fellowship as a macOS LaunchAgent.
# Starts automatically on login, restarts if it crashes.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_NAME="ai.multica.fellowship"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
SERVICE_SCRIPT="$REPO_ROOT/scripts/fellowship-service.sh"
LOG_DIR="$REPO_ROOT/.logs"

install() {
  mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${SERVICE_SCRIPT}</string>
        <string>start</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd.err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>
</dict>
</plist>
EOF

  # Load the agent
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  launchctl load "$PLIST_PATH"

  echo "✓ The Fellowship LaunchAgent installed."
  echo "  Plist:   $PLIST_PATH"
  echo "  Logs:    $LOG_DIR/launchd.log"
  echo ""
  echo "  The Fellowship will now start automatically when you log in."
  echo "  To start now:  launchctl start $PLIST_NAME"
  echo "  To stop:       launchctl stop $PLIST_NAME"
  echo "  To uninstall:  bash $0 uninstall"
}

uninstall() {
  if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "✓ LaunchAgent removed. The Fellowship will no longer auto-start."
  else
    echo "No LaunchAgent found at $PLIST_PATH"
  fi
}

case "${1:-install}" in
  install)   install ;;
  uninstall) uninstall ;;
  *)
    echo "Usage: $0 {install|uninstall}"
    exit 1
    ;;
esac
