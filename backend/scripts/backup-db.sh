#!/usr/bin/env bash
# Backup do banco (pg_dump -Fc). Variáveis: PGCONTAINER (usa docker exec), BACKUP_DIR, RETENTION_DAYS.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_db-env.sh"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/inventory}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/inventory-$(date +%Y%m%d-%H%M%S).dump"

if [ -n "${PGCONTAINER:-}" ]; then
  docker exec -e PGPASSWORD="$PGPASSWORD" "$PGCONTAINER" pg_dump -Fc -U "$PGUSER" -d "$PGDATABASE" > "$out.partial"
else
  pg_dump -Fc > "$out.partial"
fi
mv "$out.partial" "$out"
find "$BACKUP_DIR" -maxdepth 1 -name 'inventory-*.dump' -mtime "+$RETENTION_DAYS" -delete
echo "Backup criado: $out ($(du -h "$out" | cut -f1))"
