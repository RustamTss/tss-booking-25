#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . env.local
  set +a
fi

usage() {
  echo "Использование: scripts/run.sh [up|down|logs|seed|fmt]"
  echo "  up   - docker-compose up -d --build (5190 фронт, 8090 бэк, Mongo)"
  echo "  down - docker-compose down"
  echo "  logs - docker-compose logs -f"
  echo "  seed - создать временного админа через /debug/seed-admin"
  echo "  fmt  - go fmt ./... для backend"
}

cmd="${1:-help}"

case "$cmd" in
  up)
    docker-compose up -d --build
    ;;
  down)
    docker-compose down
    ;;
  logs)
    docker-compose logs -f
    ;;
  seed)
    curl -X POST http://localhost:8090/debug/seed-admin || true
    ;;
  fmt)
    (cd backend && go fmt ./...)
    ;;
  *)
    usage
    ;;
esac

