# Backend

API Fastify + Prisma (PostgreSQL).

## Primeiro administrador

A única rota pública é `POST /auth/login`. Para criar o primeiro administrador
(ou recuperar o acesso de um), use o script `create-admin`:

```bash
cd backend
ADMIN_NAME="Administrador" \
ADMIN_EMAIL="admin@empresa.com" \
ADMIN_PASSWORD="uma-senha-forte" \
npm run create-admin
```

- O e-mail é normalizado (`trim` + minúsculas).
- A senha deve ter entre 8 e 72 caracteres.
- Idempotente: se já existir usuário com o e-mail, ele é promovido a `ADMIN`,
  reativado e tem a senha redefinida (o nome é mantido); caso contrário, é criado.

## Autenticação

- `POST /auth/login` com `{ email, password }` →
  `200 { data: { token, user: { id, name, email, role } } }`.
- Envie `Authorization: Bearer <token>` nas demais rotas. O token (HS256) expira
  em 8 horas; a cada requisição o usuário é conferido no banco: usuário
  inexistente ou desativado → `401 "Sessão inválida."`.
- 10 falhas de login para o mesmo IP + e-mail em 15 minutos →
  `429 TOO_MANY_ATTEMPTS` (contador em memória, zerado após login com sucesso).

## Banco de testes

`npm test` roda em um banco separado, definido por `TEST_DATABASE_URL` (veja `.env.example`). O nome do banco **deve terminar em `_test`**; caso contrário os testes abortam antes de tocar em qualquer dado (em CI, com `CI=true`, vale `DATABASE_URL`). Para criar e migrar o banco de testes (idempotente):

```
npm run test:db:prepare
```

## Backup e restauração

```
PGCONTAINER=api_db_1 npm run backup-db           # sem PGCONTAINER usa o pg_dump local
npm run restore-db -- <arquivo.dump> <banco-destino> [--yes]
```

O backup vai para `${BACKUP_DIR:-$HOME/backups/inventory}/inventory-AAAAMMDD-HHMMSS.dump` e remove dumps com mais de `RETENTION_DAYS` (padrão 14) dias. A restauração recusa o banco `inventory` (e o de `DATABASE_URL`) sem `--force` e, para eles, sempre pede confirmação digitada; para outros bancos, `--yes` dispensa a confirmação. Credenciais vêm de `DATABASE_URL` (`backend/.env`). Exemplo de cron diário às 02:00:

```
PATH=/usr/local/bin:/usr/bin:/bin  # inclua o diretório do node/npm (ex.: ~/.nvm/versions/node/<versão>/bin)
0 2 * * * mkdir -p $HOME/backups/inventory && cd /caminho/inventory-system/backend && PGCONTAINER=api_db_1 npm run backup-db >> $HOME/backups/inventory/cron.log 2>&1
```

## Produção

```bash
npm ci
npx prisma generate
npm run build        # gera dist/server.js (aliases resolvidos; node_modules ficam externos)
npm start            # node dist/server.js
```

- Variáveis (veja `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT` (3000), `HOST` (0.0.0.0), `CORS_ORIGINS`, `TRUST_PROXY`. A subida falha listando as variáveis inválidas; com `NODE_ENV=production` o `JWT_SECRET` precisa ter 32+ caracteres e `CORS_ORIGINS` é obrigatório.
- `TRUST_PROXY=true` confia em qualquer `X-Forwarded-For` (o cliente pode forjar o IP e fugir do rate limit); prefira o número de saltos (ex.: `1`) ou a lista de IPs dos proxies.
- `GET /health` (público): `200 {"status":"ok"}` ou `503 {"status":"unavailable"}` se o banco estiver fora.
- Rate limit: 300 req/min por usuário autenticado (ou IP), 20/min em `/reports/*`; excedido → `429 RATE_LIMITED` com `Retry-After`.
- SIGTERM/SIGINT: para de aceitar conexões, espera as requisições em andamento (até 10 s) e desconecta o banco.

### Índices em banco grande

A migration `20261025120000_query_indexes` cria os índices de consulta com `CREATE INDEX IF NOT EXISTS`, o que bloqueia escritas nas tabelas durante a criação. Em produção com muitos dados, crie antes cada índice manualmente com `CREATE INDEX CONCURRENTLY IF NOT EXISTS "<nome>" ON "<Tabela>"(...)` (os comandos estão em `prisma/migrations/20261025120000_query_indexes/migration.sql`, trocando por `CONCURRENTLY`; fora de transação) e então marque a migration como aplicada: `npx prisma migrate resolve --applied 20261025120000_query_indexes`.
