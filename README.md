# Inventory System

Sistema de controle de estoque (monorepo).

- `backend/`: API Fastify 5 + Prisma 6 + PostgreSQL (testes com `node:test` via `tsx`).
- `frontend/`: React 19 + Vite + Vitest + ESLint.

## Pré-requisitos

- Node 22
- PostgreSQL (local ou via Docker)

## Backend

```bash
cd backend
# crie backend/.env com as chaves: DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate deploy
ADMIN_NAME="Administrador" ADMIN_EMAIL="admin@empresa.com" ADMIN_PASSWORD="uma-senha-forte" npm run create-admin
npm run dev
```

Mais detalhes (autenticação, rotas) em [backend/README.md](backend/README.md).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Variável opcional: `VITE_API_URL`. Se definida, sempre vence. Sem ela, o `npm run dev` usa `/api`, que o Vite encaminha para o backend em `http://localhost:3000` (mesma origem da página, sem CORS nem conteúdo misto); um build de produção sem a variável também usa `/api` (mesma origem, atrás do proxy reverso, veja "Produção" abaixo). O `npm run preview` encaminha `/api` para `http://localhost:3000` como o dev.

### Abrir o sistema no celular ou tablet (desenvolvimento)

No computador, `npm run dev` sobe em `http://localhost:5173`. A câmera do navegador só funciona em conexão segura, então para testar no celular use `npm run dev:https`, que sobe em **HTTPS** com certificado autoassinado (`@vitejs/plugin-basic-ssl`, só no dev).

1. Suba o backend (`cd backend && npm run dev`) e o frontend (`cd frontend && npm run dev:https`).
2. Deixe o celular na **mesma rede Wi-Fi** do computador.
3. Descubra o IP do computador na rede (`ipconfig` no Windows, `ip addr` no Linux/macOS).
4. No celular abra `https://<ip-do-pc>:5173`.
5. O navegador avisa que o certificado não é confiável: aceite (Avançado → Continuar). É necessário uma vez por aparelho.
6. Permita o uso da câmera quando o navegador perguntar. Se negar sem querer, libere nas configurações do site e use "Tentar de novo" no leitor.

A API é acessada pelo mesmo endereço (`/api`), então não é preciso abrir a porta 3000 para o celular.

**WSL:** se o Vite roda dentro do WSL2, o celular não alcança a porta direto. No Windows (PowerShell como administrador), encaminhe a porta e libere no firewall, usando o IP do WSL (`wsl hostname -I`):

```powershell
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=<ip-do-wsl>
New-NetFirewallRule -DisplayName "Vite 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
```

(O IP do WSL muda ao reiniciar; refaça o `portproxy`. Alternativa: `networkingMode=mirrored` no `.wslconfig`.)

### Produção (nginx, HTTPS, mesma origem)

O frontend precisa ser servido por **HTTPS** com certificado válido; sem isso o leitor de código de barras mostra a mensagem de conexão segura e só resta digitar o código. O build usa `/api` por padrão, então o nginx serve o `dist` e encaminha `/api/` ao backend na mesma origem (sem conteúdo misto e sem CORS entre origens).

```bash
cd frontend && npm run build   # gera frontend/dist (não defina VITE_API_URL)
```

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name estoque.exemplo.com;

    ssl_certificate     /etc/letsencrypt/live/estoque.exemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/estoque.exemplo.com/privkey.pem;

    root /var/www/estoque/dist;
    index index.html;

    # API: o "/" final em proxy_pass troca o prefixo /api/ por /, então /api/products vira /products no backend.
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA: qualquer outra rota cai no index.html.
    location / {
        try_files $uri /index.html;
    }
}

server {
    listen 80;
    server_name estoque.exemplo.com;
    return 301 https://$host$request_uri;
}
```

No backend (`backend/.env`):

```bash
NODE_ENV=production
TRUST_PROXY=1                                  # um proxy na frente: rate limit e login enxergam o IP real
CORS_ORIGINS="https://estoque.exemplo.com"     # continua obrigatório em produção: a origem do site
COMPANY_CNPJ="11444777000161"                  # obrigatório em produção: CNPJ da empresa; só NF-e destinadas a ele são importadas
```

**Limite de tentativas de login:** o estado fica em memória do processo (instância única da API): 10 falhas/15 min por IP+e-mail, 30 por conta (de qualquer IP) e 50 por IP (de qualquer e-mail); login com sucesso zera IP+e-mail e conta, mas não o contador do IP. Com mais de uma instância da API (ou reinício frequente) cada processo conta separado: nesse caso use um armazenamento compartilhado (ex.: Redis) para os contadores.

Mesmo com tudo na mesma origem, `CORS_ORIGINS` deve conter a origem do site (esquema + domínio, sem barra final). Se preferir a API em outro domínio, defina `VITE_API_URL=https://api.exemplo.com` no build e inclua a origem do frontend em `CORS_ORIGINS`.

## Banco legado (criado antes de out/2026)

Algumas migrations antigas falham num banco que já tinha dados. Elas não foram reescritas (mudaria o checksum de bancos que já as aplicaram). Em um banco legado, faça backup (`cd backend && PGCONTAINER=<container> npm run backup-db`) e siga o procedimento manual abaixo **antes** do `prisma migrate deploy`. Em banco novo ou já migrado, nada a fazer.

**1. `20261021022145_nome_da_alteracao` (`Customer.code NOT NULL` sem backfill).** Confira se há clientes e se a coluna já existe:

```sql
SELECT count(*) AS clientes FROM "Customer";
SELECT column_name FROM information_schema.columns WHERE table_name = 'Customer' AND column_name = 'code';
```

Se há clientes e a coluna não existe, aplique à mão o equivalente da migration, com backfill pela faixa `CUSTOMER` (código `C` + 6 dígitos), e marque-a como aplicada (aqui `--applied` é correto porque o SQL abaixo faz tudo que a migration faria; `--applied` também aceita uma migration que falhou):

```sql
BEGIN;
ALTER TABLE "Customer" ADD COLUMN "code" TEXT;
UPDATE "Customer" c SET "code" = 'C' || lpad(n.rn::text, 6, '0')
  FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn FROM "Customer") n
  WHERE c.id = n.id;
ALTER TABLE "Customer" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");
INSERT INTO "NumberRange" ("id", "name", "currentValue", "updatedAt")
  VALUES (gen_random_uuid()::text, 'CUSTOMER', (SELECT count(*) FROM "Customer"), now())
  ON CONFLICT ("name") DO UPDATE SET "currentValue" = GREATEST("NumberRange"."currentValue", EXCLUDED."currentValue");
COMMIT;
```

```bash
cd backend && npx prisma migrate resolve --applied 20261021022145_nome_da_alteracao
```

**2. `20261023180000_user_active_email_normalized` (`UPDATE users SET email = lower(trim(email))` pode violar `users_email_key`).** Procure e-mails que só diferem por caixa/espaço:

```sql
SELECT lower(trim(email)) AS email, count(*), array_agg(id) AS ids
FROM "users" GROUP BY 1 HAVING count(*) > 1;
```

Se aparecer alguma linha, decida com o responsável qual conta manter e altere o e-mail das outras à mão (por exemplo, acrescentando um sufixo identificável). Depois rode `npx prisma migrate deploy`. Sem duplicatas, a migration roda normalmente.

Se o `migrate deploy` já falhou nessa migration, nada dela foi aplicado (o script roda numa única transação: a coluna `active` não existe) e o Prisma bloqueia os próximos deploys com P3009. Corrija os e-mails, marque a migration como **revertida** (não como aplicada) e rode de novo:

```bash
cd backend
npx prisma migrate resolve --rolled-back 20261023180000_user_active_email_normalized
npx prisma migrate deploy
```

Não use `--applied` aqui: ele registraria a migration como feita sem a coluna `active`, e toda consulta de usuário (inclusive o login) falharia com 500. (Só se você aplicasse à mão **os dois** comandos da migration, `ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;` e o `UPDATE`, é que `--applied` seria correto.)

**2b. `20261022170000_inventory_lot_unique_batch` (índice único `(productVariantId, batchNumber)` em `InventoryLot`).** Falha se houver o mesmo número de lote repetido na mesma variante. Confira; deve devolver 0 linhas:

```sql
SELECT "productVariantId", "batchNumber", count(*) FROM "InventoryLot"
WHERE "batchNumber" IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
```

Se aparecerem linhas, renomeie o lote repetido à mão (com o responsável) antes do `migrate deploy`. Se o deploy já falhou nela, após corrigir use `npx prisma migrate resolve --rolled-back 20261022170000_inventory_lot_unique_batch` e depois `npx prisma migrate deploy`.

**3. `20261026180000_integrity_checks` (CHECKs de estoque/valores e índice único de origem financeira).** Falha se já houver dado inconsistente. Confira antes; as consultas devem devolver 0:

```sql
SELECT count(*) FROM "Inventory" WHERE quantity < 0 OR "reservedQuantity" < 0 OR "reservedQuantity" > quantity;
SELECT count(*) FROM "InventoryLot" WHERE "remainingQuantity" < 0 OR "remainingQuantity" > "initialQuantity";
SELECT count(*) FROM "InventoryBoxStock" WHERE quantity <= 0;
SELECT count(*) FROM "Payment" WHERE amount <= 0;
SELECT count(*) FROM "FinancialParcel" WHERE amount <= 0;
SELECT count(*) FROM "SaleItem" WHERE quantity <= 0;
SELECT count(*) FROM "PurchaseItem" WHERE quantity <= 0;
SELECT type, "originType", "originId", count(*) FROM "FinancialDocument"
  WHERE "originType" IN ('SALE', 'PURCHASE') AND status <> 'CANCELED'
  GROUP BY 1, 2, 3 HAVING count(*) > 1;
```

Corrija o dado com decisão do responsável (por exemplo, cancelar o documento duplicado) antes de aplicar a migration. Se o deploy já falhou nela, nada foi aplicado (transação única): depois de corrigir, `npx prisma migrate resolve --rolled-back 20261026180000_integrity_checks` e `npx prisma migrate deploy`.

## Testes e checagens

Backend (os testes usam o banco de `DATABASE_URL`, então precisam de um PostgreSQL com as migrations aplicadas; o banco pode estar vazio):

```bash
cd backend
npm test
npm run typecheck
```

Frontend:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
```

## CI

O workflow `.github/workflows/ci.yml` roda em todo push e pull request:

- `backend`: sobe um PostgreSQL 16 de serviço, aplica `prisma migrate deploy` num banco vazio, `prisma generate`, `npm run typecheck` e `npm test`.
- `frontend`: `npm run lint`, `npm run typecheck`, `npm test` e `npx vite build`.
