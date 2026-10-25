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

Variável opcional: `VITE_API_URL`. Se definida, sempre vence. Sem ela, o `npm run dev` usa `/api`, que o Vite encaminha para o backend em `http://localhost:3000` (mesma origem da página, sem CORS nem conteúdo misto); um build de produção sem a variável continua usando `http://localhost:3000`.

### Abrir o sistema no celular ou tablet (desenvolvimento)

A câmera do navegador só funciona em conexão segura, por isso o servidor de desenvolvimento sobe em **HTTPS** com certificado autoassinado (`@vitejs/plugin-basic-ssl`, só no dev).

1. Suba o backend (`cd backend && npm run dev`) e o frontend (`cd frontend && npm run dev`).
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

**Produção:** o frontend precisa ser servido por **HTTPS** com certificado válido (e a API também, para evitar conteúdo misto); sem isso o leitor mostra a mensagem de conexão segura e só resta digitar o código. Se o frontend e a API ficarem na mesma origem (proxy reverso), configure `VITE_API_URL=/api` ou o caminho correspondente no build.

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
