#!/usr/bin/env bash
# Production entrypoint: runs the HTTP API and the LiveKit voice agent in one service.
# Both read and write DATA_DIR (uploads and the search index), and a Render disk can be
# attached to only one service, so they can't be split into two.
set -uo pipefail
cd "$(dirname "$0")"

python agent.py start &
uvicorn api:app --host 0.0.0.0 --port "${PORT:-8000}" &

# Pass shutdown signals on, so the agent can let calls in progress finish.
trap 'kill -TERM $(jobs -p) 2>/dev/null; wait; exit 0' TERM INT

# If either process stops on its own, stop the other and exit so the host restarts the service.
wait -n
kill -TERM $(jobs -p) 2>/dev/null
wait
exit 1
