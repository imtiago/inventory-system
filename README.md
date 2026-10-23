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

Variável opcional: `VITE_API_URL` (padrão `http://localhost:3000`).

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
