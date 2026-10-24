# Fase 8 — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard inicial com vendas, contas a receber/pagar, estoque e compras, por permissão, calculado em SQL.

**Architecture:** `GET /dashboard` com um caso de uso que chama consultas agregadas por seção (repositório de leitura com SQL parametrizado), omitindo seções sem permissão; página React com cartões e gráfico simples.

**Tech Stack:** Fastify 5, Prisma 6 (`$queryRaw`), `node:test`; React 19, TanStack Query 5, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase8-dashboard-design.md`

## Global Constraints

- Branch `feat/phase8-dashboard`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco (esta fase não precisa de migration).
- SQL bruto só no repositório de leitura e sempre parametrizado (`$queryRaw` com template); datas pela data de negócio.
- Testes por delta ou por ids criados; nunca valores absolutos do banco compartilhado.
- CI verde: backend typecheck 0; frontend lint 0, typecheck 0; nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Venda às 23h30 em Brasília aparece em "hoje", não amanhã — teste em Task 1.
2. Vendas canceladas não contam em nenhum número — teste em Task 1.
3. ESTOQUISTA não recebe nem vê valores financeiros — teste em Task 1 e Task 2.
4. Dias sem venda aparecem com zero no gráfico (sempre 7 barras) — teste em Task 1 e Task 2.
5. Parcela paga parcialmente conta só o restante em "em aberto"/"vencido" — teste em Task 1.

---

### Task 1: Backend — `GET /dashboard`

**Files:**
- Create: `backend/src/modules/dashboard/**` (caso de uso, repositório de leitura SQL, DTO, controller, rota), registro em `app.ts`
- Create: `frontend/src/test/fixtures/dashboard/dashboard.json`
- Test: `backend/src/modules/dashboard/infrastructure/http/__tests__/dashboard.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("vendas: hoje e mês por delta; cancelada não conta; venda 23h30 BRT conta hoje")         // Review Focus 1, 2
test("last7Days sempre 7 dias com zero onde não há venda; topVariants do mês")                  // Review Focus 4
test("recebíveis/pagáveis: open, overdue e dueNext7Days usam o restante; pago não conta")       // Review Focus 5
test("estoque: variante zerada entra; lote vencendo em 30 dias entra, vencido/fora do prazo/zerado não")
test("compras aguardando recebimento: PENDING e PARTIALLY_RECEIVED")
test("seções por papel: VENDEDOR sem payables/purchases/inventory? (inventory.read sim); ESTOQUISTA sem sales/receivables/payables") // Review Focus 3
test("chaves = fixture")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(dashboard): aggregated dashboard endpoint by permission`

---

### Task 2: Frontend — página do dashboard

**Files:**
- Modify: `frontend/src/modules/dashboard/pages/DashboardPage.tsx`
- Create: `frontend/src/modules/dashboard/{services,hooks,components}/**`, handler MSW
- Test: `frontend/src/modules/dashboard/pages/__tests__/DashboardPage.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("ADMIN vê todas as seções com valores formatados")
test("ESTOQUISTA vê só estoque e compras")                                                      // Review Focus 3
test("gráfico tem 7 barras com rótulos acessíveis, incluindo dias com zero")                    // Review Focus 4
test("números linkam para listas filtradas (ex.: /receivables?status=OVERDUE)")
test("erro mostra mensagem e botão de tentar novamente")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test` 2×; lint 0; typecheck 0; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): dashboard with sales, finance, stock and purchases`
