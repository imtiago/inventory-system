#!/usr/bin/env bash
# Restaura um dump: restore-db.sh <dump> <banco-destino> [--force] [--yes]
# Recusa o banco "inventory" e o de DATABASE_URL sem --force e, para eles, sempre pede confirmação digitada;
# para outros bancos, --yes dispensa a confirmação.
# Usa PGCONTAINER (docker exec) quando definido. O banco de destino é criado se não existir.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_db-env.sh"

force=0; yes=0; args=()
for a in "$@"; do
  case "$a" in
    --force) force=1 ;;
    --yes) yes=1 ;;
    *) args+=("$a") ;;
  esac
done
[ "${#args[@]}" -eq 2 ] || { echo "Uso: restore-db.sh <dump> <banco-destino> [--force] [--yes]" >&2; exit 1; }
dump="${args[0]}"; target="${args[1]}"
[ -f "$dump" ] || { echo "Arquivo não encontrado: $dump" >&2; exit 1; }
# Banco de desenvolvimento ou o banco configurado em DATABASE_URL: confirmação digitada sempre, mesmo com --yes.
protected=0
if [ "$target" = "inventory" ] || [ "$target" = "$PGDATABASE" ]; then protected=1; fi
if [ "$protected" -eq 1 ] && [ "$force" -ne 1 ]; then
  echo "Recusado: \"$target\" é o banco em uso pela aplicação. Use --force se for intencional." >&2
  exit 1
fi
if [ "$yes" -ne 1 ] || [ "$protected" -eq 1 ]; then
  echo "Isto vai SUBSTITUIR o conteúdo do banco \"$target\"."
  read -r -p "Digite o nome do banco para confirmar: " answer
  [ "$answer" = "$target" ] || { echo "Confirmação incorreta. Abortado." >&2; exit 1; }
fi

if [ -n "${PGCONTAINER:-}" ]; then
  run() { docker exec -i -e PGPASSWORD "$PGCONTAINER" "$@"; }
  conn=(-U "$PGUSER")
else
  run() { "$@"; }
  conn=()
fi
exists="$(run psql "${conn[@]}" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='${target//\'/\'\'}'")"
[ -n "$exists" ] || run psql "${conn[@]}" -d postgres -c "CREATE DATABASE \"$target\""
run pg_restore "${conn[@]}" -d "$target" --clean --if-exists --no-owner < "$dump"
echo "Restaurado em: $target"
