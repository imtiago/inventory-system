# Uso: source _db-env.sh  -> exporta PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE a partir de DATABASE_URL
# (lida de backend/.env quando não estiver no ambiente). Nunca imprime a senha.
_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${DATABASE_URL:-}" ] && [ -f "$_dir/../.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$_dir/../.env" | head -1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^["'"'"'](.*)["'"'"']$/\1/')"
fi
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL não definida." >&2; exit 1; }
eval "$(DATABASE_URL="$DATABASE_URL" node -e '
const u = new URL(process.env.DATABASE_URL);
const q = (s) => "\x27" + String(s).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
console.log(`export PGHOST=${q(u.hostname)} PGPORT=${q(u.port || 5432)} PGUSER=${q(decodeURIComponent(u.username))} PGPASSWORD=${q(decodeURIComponent(u.password))} PGDATABASE=${q(decodeURIComponent(u.pathname.slice(1)))}`);
')"
