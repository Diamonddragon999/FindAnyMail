#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/app}"
BRANCH="${BRANCH:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
APP_NAME="${APP_NAME:-findanymail}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "APP_DIR does not look like a git repo: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

echo "==> Fetching latest code ($BRANCH)"
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Building app"
npm run build

echo "==> Restarting process ($APP_NAME)"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME"
  else
    pm2 start npm --name "$APP_NAME" -- start
  fi
  pm2 save
else
  echo "pm2 not found; starting with npm start"
  npm run start
fi

echo "Done."
