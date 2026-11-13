#!/usr/bin/env bash
# Fretwise control script.
#
#   ./fretwise.sh start          run the server in the background
#   ./fretwise.sh stop           stop it
#   ./fretwise.sh restart
#   ./fretwise.sh status         is it running, and where?
#   ./fretwise.sh logs           follow the log
#   ./fretwise.sh autostart-on   start automatically when this computer boots (systemd user service)
#   ./fretwise.sh autostart-off  undo that
#
# Settings (environment): PORT (default 8420), HTTPS_PORT (default 8421, 0 = off), FRETWISE_DATA.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="${FRETWISE_DATA:-$DIR/data}"
PIDFILE="$DATA/server.pid"
LOG="$DATA/server.log"
PORT="${PORT:-8420}"
UNIT="fretwise.service"
UNIT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$UNIT"
NODE="$(command -v node || true)"

pid() { [[ -f "$PIDFILE" ]] && cat "$PIDFILE" 2>/dev/null || true; }
running() { local p; p="$(pid)"; [[ -n "$p" ]] && kill -0 "$p" 2>/dev/null; }
service_installed() { [[ -f "$UNIT_FILE" ]]; }
need_node() { [[ -n "$NODE" ]] || { echo "Node.js was not found. Install Node 18 or newer first."; exit 1; }; }

show_addresses() {
  # the server prints its addresses when it starts; show the latest block
  if [[ -f "$LOG" ]]; then awk '/is running\./{buf=""} {buf=buf $0 "\n"} END{printf "%s", buf}' "$LOG" | sed -n '1,12p'; fi
}

start() {
  need_node
  if service_installed && systemctl --user is-active --quiet "$UNIT" 2>/dev/null; then
    echo "Fretwise is already running as a service."; show_addresses; return
  fi
  if running; then echo "Fretwise is already running (pid $(pid))."; show_addresses; return; fi
  mkdir -p "$DATA"
  if service_installed; then
    systemctl --user start "$UNIT"
  else
    cd "$DIR"
    # setsid + nohup: keep running after this terminal (or SSH session) closes
    nohup setsid "$NODE" "$DIR/server.js" >>"$LOG" 2>&1 </dev/null &
  fi
  for _ in $(seq 1 40); do
    if running && curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/info" 2>/dev/null; then show_addresses; return; fi
    sleep 0.25
  done
  echo "Fretwise did not start. Last lines of $LOG:"; tail -n 20 "$LOG" 2>/dev/null || true
  exit 1
}

stop() {
  if service_installed && systemctl --user is-active --quiet "$UNIT" 2>/dev/null; then
    systemctl --user stop "$UNIT"; echo "Fretwise stopped."; return
  fi
  if ! running; then echo "Fretwise is not running."; return; fi
  local p; p="$(pid)"
  kill "$p"
  for _ in $(seq 1 40); do kill -0 "$p" 2>/dev/null || break; sleep 0.1; done
  kill -0 "$p" 2>/dev/null && kill -9 "$p"
  rm -f "$PIDFILE"
  echo "Fretwise stopped."
}

status() {
  if running; then
    echo "Fretwise is running (pid $(pid))$(service_installed && echo ', as a service that starts with the computer')."
    show_addresses
  else
    echo "Fretwise is not running. Start it with: $0 start"
    return 1
  fi
}

autostart_on() {
  need_node
  command -v systemctl >/dev/null || { echo "systemd is not available on this computer."; exit 1; }
  mkdir -p "$(dirname "$UNIT_FILE")" "$DATA"
  running && ! systemctl --user is-active --quiet "$UNIT" 2>/dev/null && stop
  cat >"$UNIT_FILE" <<UNITEOF
[Unit]
Description=Fretwise — guitar sight-reading trainer
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$NODE $DIR/server.js
WorkingDirectory=$DIR
Environment=PORT=$PORT
Environment=HTTPS_PORT=${HTTPS_PORT:-8421}
Environment=FRETWISE_DATA=$DATA
StandardOutput=append:$LOG
StandardError=append:$LOG
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
UNITEOF
  systemctl --user daemon-reload
  systemctl --user enable --now "$UNIT"
  # "linger" lets the service run while nobody is logged in (and start at boot)
  if loginctl enable-linger "$USER" 2>/dev/null; then
    echo "Fretwise will now start whenever this computer boots."
  else
    echo "The service is installed, but it will only run while you are logged in."
    echo "To let it start at boot, run once:  sudo loginctl enable-linger $USER"
  fi
  sleep 1
  status
}

autostart_off() {
  if ! service_installed; then echo "Autostart is not set up."; return; fi
  systemctl --user disable --now "$UNIT" 2>/dev/null || true
  rm -f "$UNIT_FILE"
  systemctl --user daemon-reload
  echo "Autostart removed. (If you enabled linger only for Fretwise: loginctl disable-linger $USER)"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) tail -n 40 -f "$LOG" ;;
  autostart-on) autostart_on ;;
  autostart-off) autostart_off ;;
  *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
