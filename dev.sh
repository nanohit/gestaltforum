#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

mkdir -p .data/uploads .data/backups
npm install
npm run migrate
npm run seed
exec npm run dev -- --host 0.0.0.0
