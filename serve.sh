#!/usr/bin/env bash
# Serve the whole site (the menu and every app) from the working tree.
#   ./serve.sh            localhost only (http://localhost:8080)
#   ./serve.sh --lan      also reachable from other devices on the network (phone)
#   ./serve.sh --lan 9000 other port
# Fretwise and Woozy keep everything in the browser here; run their own servers
# (apps/fretwise/fretwise.sh, apps/woozy/server.js) to share progress between devices.
set -euo pipefail
cd "$(dirname "$0")"
host=127.0.0.1
if [[ "${1:-}" == "--lan" ]]; then host=0.0.0.0; shift; fi
port="${1:-8080}"
if [[ "$host" == 0.0.0.0 ]]; then
  for ip in $(hostname -I); do
    [[ "$ip" == *.*.*.* && "$ip" != 172.17.* ]] && echo "On your phone: http://$ip:$port/"
  done
fi
exec python3 tools/site.py serve "$host" "$port"
