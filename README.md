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
```

Mesmo com tudo na mesma origem, `CORS_ORIGINS` deve conter a origem do site (esquema + domínio, sem barra final). Se preferir a API em outro domínio, defina `VITE_API_URL=https://api.exemplo.com` no build e inclua a origem do frontend em `CORS_ORIGINS`.

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
