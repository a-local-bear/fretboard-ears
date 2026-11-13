#!/usr/bin/env bash
# Keeps Woozy running in the background and starts it again after a reboot,
# using a systemd *user* service (no root needed).
#
#   scripts/install-service.sh            install + start
#   scripts/install-service.sh remove     stop + uninstall
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/woozy.service"
PORT="${PORT:-3210}"

if [[ "${1:-}" == "remove" ]]; then
  systemctl --user disable --now woozy.service 2>/dev/null || true
  rm -f "$UNIT"
  systemctl --user daemon-reload
  echo "Woozy service removed."
  exit 0
fi

NODE="$(command -v node)" || { echo "node is not on your PATH"; exit 1; }
mkdir -p "$UNIT_DIR"
cat > "$UNIT" <<UNIT_EOF
[Unit]
Description=Woozy — bedroom-pop guitar songwriting course
After=network.target

[Service]
WorkingDirectory=$ROOT
ExecStart=$NODE $ROOT/server.js
Environment=PORT=$PORT
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
UNIT_EOF

systemctl --user daemon-reload
systemctl --user enable --now woozy.service
echo "Woozy is running as a user service on port $PORT."
echo "  status:  systemctl --user status woozy"
echo "  logs:    journalctl --user -u woozy -f"
echo
echo "To have it start at boot even before you log in, run once:"
echo "  sudo loginctl enable-linger $USER"
