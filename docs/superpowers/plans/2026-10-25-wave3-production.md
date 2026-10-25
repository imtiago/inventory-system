# Onda 3 — Desempenho e produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o sistema pronto para rodar em produção (build, desligamento gracioso, proteções HTTP, índices) e rápido com dados acumulados (financeiro no banco, frontend dividido), fechando os menores adiados da onda 2.

**Architecture:** Runtime e proteções no `app.ts`/`server.ts`/`env.ts`; uma migration só de índices; leitura financeira reescrita em SQL atrás do mesmo contrato do repositório; frontend com rotas lazy e chunks de vendor.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, `node:test`, tsup; React 19, Vite, TanStack Query 5, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-25-wave3-production-design.md`

## Global Constraints

- Branch `fix/wave3-production`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Migration: SQL à mão → `npx prisma migrate deploy` (dev e `inventory_test`) → `npx prisma generate`. Testes do backend no banco `inventory_test` (`npm test`; arquivo isolado `npx tsx --import ./src/test/bootstrap.ts --test <arquivo>`).
- Dependências novas permitidas só: `@fastify/helmet`, `@fastify/rate-limit`, `tsup` (dev). Nenhuma outra.
- Mensagens e códigos exatamente como na spec; erros pelas classes de `@shared/domain/errors`.
- CI verde: backend typecheck, testes, build + smoke; frontend lint 0, typecheck 0, testes, build.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Requisições em andamento terminam antes do processo sair no SIGTERM; `/health` responde sem token — Task 1.
2. A suíte de testes (muitas requisições por usuário) não é derrubada pelo rate limit, e produção não sobe sem `CORS_ORIGINS`/`JWT_SECRET` forte — Task 1.
3. Lista, resumo e exportação de contas a receber/pagar devolvem exatamente o mesmo que antes para cada filtro (parcial, estornado, cancelado, vencido hoje no fuso de negócio) — Task 3.
4. A migration de índices aplica num banco com dados e não muda nenhuma tabela além de índices — Task 2.
5. Navegar entre telas após um deploy novo (chunk antigo some) não deixa tela branca — Task 4.

---

### Task 1: Execução em produção e proteções HTTP (spec §1–2)
- [ ] Testes (falhando): env inválido lista variáveis; produção sem `CORS_ORIGINS`/segredo curto não sobe; `/health` 200 sem token e 503 com banco fora (porta de leitura injetável); helmet headers presentes; 429 `RATE_LIMITED` com `Retry-After` (limite baixo injetado no teste); CORS com lista recusa origem fora; 413/415/JSON malformado/P2028 com os códigos da spec; shutdown espera requisição em andamento (teste com `app.close()` durante uma rota lenta de teste).
- [ ] Implementar (`buildApp(options)` se necessário para injetar limites; `server.ts` com PORT/HOST/sinais); `tsup` build; `.env.example`; README; CI build + smoke.
- [ ] `npm run build && node dist/server.js` local sobe e `/health` = 200; suíte 2×, typecheck.
- [ ] Commit — `feat(backend): production build, graceful shutdown, health check, rate limit, helmet and strict CORS`

### Task 2: Índices (spec §3)
- [ ] Migration `<timestamp>_query_indexes` com `CREATE INDEX IF NOT EXISTS`, `@@index` no schema; `migrate deploy` em dev e `inventory_test`; teste que confere a existência dos índices em `pg_indexes`; `EXPLAIN` das consultas de origem (StockMovement por origem, FinancialDocument por origem) usando índice — registrar no relatório.
- [ ] Commit — `perf(db): indexes for origin lookups, history ordering and foreign keys`

### Task 3: Financeiro no banco (spec §4)
- [ ] Teste de equivalência (falha só se o resultado divergir — rodar contra a implementação atual primeiro para fixar as expectativas), teste de que a exportação acima do teto não carrega tudo (limite no SQL), dashboard igual.
- [ ] Reescrever `PrismaFinancialDocumentReadRepository` list/summary/export em SQL; dashboard restrito a abertos; suítes 2×.
- [ ] Commit — `perf(finance): compute receivable/payable lists, summary and export in SQL`

### Task 4: Frontend leve + menores da onda 2 (spec §5–6)
- [ ] Testes (falhando) por item da §6 e para o aviso de chunk que falhou; lazy routes, scanner sob demanda, manualChunks; build sem aviso, entrada < 250 kB.
- [ ] Commit — `perf(frontend): route code splitting, on-demand scanner and wave 2 leftovers`
