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

O backup vai para `${BACKUP_DIR:-$HOME/backups/inventory}/inventory-AAAAMMDD-HHMMSS.dump` e remove dumps com mais de `RETENTION_DAYS` (padrão 14) dias. A restauração recusa o banco `inventory` sem `--force` e pede confirmação digitada (`--yes` dispensa). Credenciais vêm de `DATABASE_URL` (`backend/.env`). Exemplo de cron diário às 02:00:

```
0 2 * * * cd /caminho/inventory-system/backend && PGCONTAINER=api_db_1 npm run backup-db >> $HOME/backups/inventory/cron.log 2>&1
```
