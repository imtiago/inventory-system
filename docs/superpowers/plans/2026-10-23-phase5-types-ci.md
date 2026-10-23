# Fase 5 — Tipos zerados e CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zerar erros de tipo e de lint, fazer a suíte rodar num banco vazio e travar tudo num CI do GitHub Actions.

**Architecture:** Remover código sem rota e quebrado; corrigir código vivo sem atalhos de tipo; gerador de numeração cria faixas sob demanda; workflow com Postgres de serviço.

**Tech Stack:** TypeScript 5, Fastify/Prisma, React/Vite, ESLint, `node:test`, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-23-phase5-types-ci-design.md`

## Global Constraints

- Branch `chore/phase5-types-ci`; `git add`/`git rm` com caminhos explícitos.
- Sem `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as` ou `eslint-disable` novos.
- Remoção só de código sem uso em tempo de execução, confirmada por `grep` (listar no relatório).
- Comportamento das rotas existentes inalterado: todas as suítes continuam verdes (backend 347, frontend 196 como linha de base).
- Nenhuma dependência nova (o CI pode usar actions oficiais `actions/checkout`, `actions/setup-node`).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Uma remoção apaga algo ainda usado em tempo de execução (rota registrada, factory importada por outro módulo, seed) — conferir por `grep` e pela suíte, Task 1.
2. Banco de produção novo: primeira venda/cliente/produto sem faixa de numeração criada → deve funcionar (faixa criada sob demanda, sem corrida entre duas criações simultâneas) — teste em Task 1.
3. Testes que passam no dev mas falham no CI por depender de dados existentes ou de ordem — verificação em banco vazio em Task 3.
4. Correção de tipo que muda comportamento (ex.: `SaleCreatePage`) — teste existente/novo cobre, Task 2.

---

### Task 1: Backend — tipos zerados e numeração sob demanda

**Files:**
- Delete: código sem rota listado na spec (camada de aplicação de `purchases`, `Payable*`, repositórios/mappers legados de recebíveis), após `grep`
- Modify: `UserMapper`, `prisma/seeds/customer.seed.ts`, gerador de numeração (`shared/...NumberGenerator` — upsert atômico da faixa), `backend/package.json` (`typecheck`)
- Test: `backend/src/shared/infrastructure/**/__tests__/numberGenerator.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("gera número quando a faixa não existe (cria sob demanda)")                       // Review Focus 2
test("duas gerações simultâneas numa faixa inexistente → números distintos, sem erro")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar; remover código morto; corrigir código vivo.**
- [ ] **Step 4:** `npx tsc --noEmit` → 0 erros; `npm test` 3× verde.
- [ ] **Step 5: Commit** — `chore(backend): zero type errors, remove unrouted dead code, on-demand number ranges`

---

### Task 2: Frontend — tipos e lint zerados

**Files:**
- Modify: `frontend/src/components/ui/table.tsx`, `frontend/src/modules/sales/pages/SaleCreatePage.tsx`, arquivos com erros de lint, `frontend/package.json` (`typecheck`)

- [ ] **Step 1:** Se a correção de `SaleCreatePage` mudar comportamento, escrever antes o teste que fixa o comportamento esperado (Review Focus 4).
- [ ] **Step 2: Corrigir.**
- [ ] **Step 3:** `npx tsc -b` → 0; `npx eslint .` → 0 erros; `npm test` 2× verde; `npx vite build` ok.
- [ ] **Step 4: Commit** — `chore(frontend): zero type and lint errors`

---

### Task 3: CI, banco vazio e README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md` (raiz)
- Modify: setup de testes do backend, se necessário, para rodar num banco vazio

- [ ] **Step 1:** Criar um banco local vazio (ex.: `inventory_ci_check` no mesmo servidor do `DATABASE_URL`), `prisma migrate deploy` nele, rodar `npm test` com `DATABASE_URL` apontando para ele; corrigir o que falhar (Review Focus 3); remover o banco ao final.
- [ ] **Step 2:** Escrever o workflow conforme a spec (jobs `backend` e `frontend`); validar sintaxe (`actionlint` se disponível, senão revisão).
- [ ] **Step 3:** README com como rodar, testar, `create-admin` e o que o CI exige.
- [ ] **Step 4: Commit** — `ci: GitHub Actions for backend and frontend with fresh-database test run`
