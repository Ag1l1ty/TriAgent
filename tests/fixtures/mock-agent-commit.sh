#!/bin/bash
set -euo pipefail

slug=$(printf '%s' "$*" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')
file_name="${slug:-task}-output.txt"

echo "Starting task: $*"
printf 'task=%s\n' "$*" > "$file_name"
git add "$file_name"
git commit -m "mock commit: ${slug:-task}" >/dev/null
echo "Committed $file_name"
