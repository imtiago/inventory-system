# Fase 9 — Filtro com saldo e exportação CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Listas financeiras com filtro "somente com saldo" coerente com o dashboard e exportação CSV de vendas, itens vendidos, estoque, contas a receber e a pagar.

**Architecture:** `openOnly` no repositório de leitura financeiro (mesma regra de saldo do dashboard); módulo `reports` com consultas SQL e um escritor CSV compartilhado (BOM, `;`, vírgula decimal, escape e neutralização de fórmulas); frontend com caixa de filtro e botões de download.

**Tech Stack:** Fastify 5, Prisma 6, `node:test`; React 19, TanStack Query 5, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-24-phase9-balance-filter-exports-design.md`

## Global Constraints

- Branch `feat/phase9-balance-filter-exports`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Se precisar de índice: diff só leitura (`--from-schema-datasource … --to-schema-datamodel …`) → SQL à mão → `migrate deploy` → `generate`.
- SQL bruto só em repositórios de leitura, parametrizado.
- Testes isolados por ids criados ou por período exclusivo (ex.: datas em 2099); nunca valores globais absolutos.
- CI verde: backend typecheck 0; frontend lint 0, typecheck 0; nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Documento parcialmente pago aparece com `openOnly`; pago e cancelado não — teste em Task 1.
2. Nome de cliente `=HYPERLINK("x")` sai como `'=HYPERLINK(""x"")` no CSV — teste em Task 2.
3. Valores 1234.5 saem `1234,50` e datas no fuso de Brasília (venda 23h30 → dia certo) — teste em Task 2.
4. VENDEDOR não exporta contas a pagar; ESTOQUISTA não exporta vendas nem financeiro — teste em Task 2.
5. Exportar usa os mesmos filtros que estão na tela — teste em Task 3.

---

### Task 1: Backend — filtro `openOnly`

**Files:**
- Modify: schema da lista financeira, `PrismaFinancialDocumentReadRepository` (filtro + summary), testes de receivables/payables
- Test: `backend/src/modules/finance/infrastructure/http/__tests__/openOnly.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("openOnly=true: parcial fica, pago e cancelado saem; summary coerente")                         // Review Focus 1
test("openOnly + dueFrom/dueTo: só documentos com parcela com saldo no intervalo")
test("sem openOnly nada muda; openOnly inválido → 400; vale para /receivables e /payables")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(finance): open-balance filter on receivables and payables lists`

---

### Task 2: Backend — relatórios CSV

**Files:**
- Create: `backend/src/shared/http/csv.ts` (escritor + formatação pt-BR), `backend/src/modules/reports/**` (consultas, casos de uso, controllers, rotas `/reports/*.csv`), registro em `app.ts`
- Test: `backend/src/shared/http/__tests__/csv.test.ts`, `backend/src/modules/reports/infrastructure/http/__tests__/reports.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("csv: BOM, ';', escape de aspas/';'/quebra de linha, injeção de fórmula neutralizada")       // Review Focus 2
test("vendas e itens: período obrigatório ≤ 366 dias; colunas, vírgula decimal, data dd/mm/aaaa BRT") // Review Focus 3
test("estoque, contas a receber e a pagar com os filtros da lista")
test("limite de linhas → 422 EXPORT_TOO_LARGE (limite injetável no teste)")
test("permissões por papel e Content-Disposition com nome do relatório")                         // Review Focus 4
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(reports): CSV exports for sales, stock and finance`

---

### Task 3: Frontend — filtro e exportação

**Files:**
- Modify: listas de contas a receber/pagar (caixa "Somente com saldo"), dashboard (links), listas de vendas e estoque e financeiro (botões de exportar)
- Create: `frontend/src/shared/utils/download.ts` (blob + Content-Disposition)
- Test: testes das listas e do dashboard

- [ ] **Step 1: Testes (falhando)**
```tsx
test("caixa Somente com saldo envia openOnly=true e é lida da URL")
test("links do dashboard: Em aberto e Vencendo em 7 dias com openOnly=true")
test("Exportar CSV envia os filtros atuais e baixa o arquivo; erro aparece uma vez")             // Review Focus 5
test("botões de exportar por permissão")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test` 2×; lint 0; typecheck 0; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): open-balance filter and CSV export buttons`
