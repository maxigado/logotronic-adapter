#!/bin/sh
set -e

# Attempt to update code from origin if .git exists
if [ -d ".git" ]; then
  echo "Found .git, attempting to fetch latest from origin..."
  # Ensure we have origin configured; try safe fetch
  git remote get-url origin >/dev/null 2>&1 || echo "No origin remote configured"
  if git fetch --all --prune; then
    echo "Fetched updates; attempting fast-forward merge on current branch"
    git pull --ff-only || echo "No fast-forward available or pull failed; continuing with local code"
  else
    echo "git fetch failed; continuing with existing code"
  fi
else
  echo ".git not present in container; skipping git pull"
fi

# Start the node application
exec "$@"
