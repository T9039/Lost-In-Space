#!/usr/bin/env bash
# Local TCP tunnel for psql/ETL on networks that block outbound 5432.
#
#   SSH_HOST=archleo DATABASE_URL="$DATABASE_URL_UNPOOLED" npm run db:tunnel
#
# The script checks that SSH_HOST can reach the database on 5432, opens
# localhost:$LOCAL_PORT -> remote:5432, and prints the DATABASE_URL to use in
# another terminal. Press Ctrl-C to close the tunnel.
#
#   SSH_HOST=archleo DATABASE_URL=... bash scripts/db-tunnel.sh --print
#
# prints the rewritten local URL without opening the tunnel.

set -euo pipefail

LOCAL_PORT="${LOCAL_PORT:-5433}"
URL="${DATABASE_URL:-${DATABASE_URL_UNPOOLED:-}}"
SSH_HOST="${SSH_HOST:-}"

if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL or DATABASE_URL_UNPOOLED." >&2
  exit 1
fi

parsed="$(python3 - "$URL" "$LOCAL_PORT" <<'PY'
import sys, urllib.parse
url, local_port = sys.argv[1], sys.argv[2]
parts = urllib.parse.urlsplit(url)
if not parts.hostname:
    raise SystemExit("DATABASE_URL has no host")
remote_port = parts.port or 5432
userinfo = parts.netloc.rsplit("@", 1)[0] + "@" if "@" in parts.netloc else ""
pairs = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
if parts.hostname.endswith(".neon.tech"):
    endpoint = parts.hostname.split(".")[0]
    pairs = [(k, v) for k, v in pairs if k not in ("channel_binding", "options")]
    pairs.append(("options", f"endpoint={endpoint}"))
query = urllib.parse.urlencode(pairs)
local = urllib.parse.urlunsplit(
    (parts.scheme, f"{userinfo}localhost:{local_port}", parts.path, query, parts.fragment)
)
print(parts.hostname, remote_port, local)
PY
)"
read -r REMOTE_HOST REMOTE_PORT LOCAL_URL <<<"$parsed"

if [[ "${1:-}" == "--print" ]]; then
  printf '%s\n' "$LOCAL_URL"
  exit 0
fi

if [[ -z "$SSH_HOST" ]]; then
  echo "Set SSH_HOST to a machine that can reach TCP/5432." >&2
  exit 1
fi

echo "Checking $SSH_HOST -> $REMOTE_HOST:$REMOTE_PORT ..." >&2
if ! ssh "$SSH_HOST" "timeout 6 bash -c '</dev/tcp/$REMOTE_HOST/$REMOTE_PORT'" 2>/dev/null; then
  echo "SSH_HOST cannot reach $REMOTE_HOST:$REMOTE_PORT. Try a VPS, VPN or Tailscale exit node." >&2
  exit 1
fi

cat >&2 <<EOF

Tunnel: localhost:$LOCAL_PORT -> $REMOTE_HOST:$REMOTE_PORT via $SSH_HOST
In another terminal, export:

  DATABASE_URL='$LOCAL_URL'

Then run psql or the Python ETL. Press Ctrl-C here to close the tunnel.
