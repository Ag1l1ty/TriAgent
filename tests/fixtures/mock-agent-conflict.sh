#!/bin/bash
set -euo pipefail

label="${1:-default}"
shift || true

echo "Starting task for ${label}: $*"
printf '%s:%s\n' "$label" "$*" > shared-output.txt
git add shared-output.txt
git commit -m "conflict ${label}" >/dev/null
echo "Committed shared-output.txt for ${label}"
