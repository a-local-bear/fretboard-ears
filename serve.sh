#!/usr/bin/env bash
# Stamp the service-worker version, then serve on localhost. Usage: ./serve.sh [port]
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/stamp_version.py
exec python3 tools/serve.py 127.0.0.1 "${1:-8080}"
