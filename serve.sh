#!/usr/bin/env bash
# Stamp the service-worker version, then serve the app.
#   ./serve.sh            localhost only (http://localhost:8080)
#   ./serve.sh --lan      also reachable from other devices on the network (phone)
#   ./serve.sh --lan 9000 other port
set -euo pipefail
cd "$(dirname "$0")"
host=127.0.0.1
if [[ "${1:-}" == "--lan" ]]; then host=0.0.0.0; shift; fi
port="${1:-8080}"
python3 tools/stamp_version.py
if [[ "$host" == 0.0.0.0 ]]; then
  for ip in $(hostname -I); do
    [[ "$ip" == *.*.*.* && "$ip" != 172.17.* ]] && echo "On your phone: http://$ip:$port/"
  done
fi
exec python3 tools/serve.py "$host" "$port"
