# Onda 1 — Segurança e integridade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os achados altos de segurança/integridade da revisão geral e separar o banco de testes, com backup do banco.

**Architecture:** Mudanças pontuais nos módulos afetados (auth, inventory, catalog, nfe-import), invariante de estoque em caixas mantida no repositório de lotes/caixas dentro da transação, infraestrutura de testes com banco próprio e scripts de backup/restore.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, `node:test`, shell/pg_dump; React 19 (troca de senha devolve token).

**Spec:** `docs/superpowers/specs/2026-10-25-wave1-integrity-design.md`

## Global Constraints

- Branch `fix/wave1-integrity`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Migrations: diff só leitura → SQL à mão → `migrate deploy` → `generate`.
- Códigos e mensagens exatamente como na spec; erros pelas classes de `@shared/domain/errors`.
- CI verde: backend typecheck 0; frontend lint 0 e typecheck 0; nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Token emitido antes da troca de senha (mesmo segundo/segundo anterior) → 401; o token devolvido pela troca funciona — Task 1.
2. Venda de 5 unidades de um lote com 8 em caixas e saldo 10 → saldo 5, alocações reduzidas para 5 (mais antigas primeiro) — Task 2.
3. Movimento manual com origem SALE é recusado; cancelamento de venda nunca dá 500 — Task 1.
4. `npm test` com `DATABASE_URL` do banco de dev aborta antes de escrever qualquer coisa — Task 3.
5. Restore só acontece com confirmação explícita — Task 3.

---

### Task 1: Backend — sessões, origens manuais, limites (spec §1–4)

**Files:** auth (migration `passwordChangedAt`, use cases de senha, `authenticate`, session reader, create-admin), inventory (schemas receive/dispatch/lots/initial-count, ReturnSaleStock, etiquetas), catalog (salePrice), nfe-import (parser e confirmação), demais schemas monetários; frontend: troca de senha guarda o novo token.
- [ ] **Step 1: Testes (falhando)** — token anterior à troca/redefinição → 401; nova senha devolve token válido; /receive com origin SALE → 400; ReturnSaleStock inconsistente → 409; etiquetas 501 → 400; salePrice acima do teto → 400; NF-e acima dos tetos → 422 com item; frontend: alterar senha substitui o token.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration.** - [ ] **Step 4: PASS + suítes; typecheck/lint 0.**
- [ ] **Step 5: Commit** — `fix: revoke sessions on password change, restrict manual stock origins, bound inputs`

### Task 2: Backend — estoque em caixas consistente (spec §5)

**Files:** repositórios de lote/caixa do inventory, Dispatch/Adjust (e onde mais `remainingQuantity` cair), rota de remoção da caixa, script `fix-box-stock`.
- [ ] **Step 1: Testes (falhando)** — saída reduz alocações (mais antigas primeiro) e mantém Σ ≤ saldo; ajuste para baixo idem; venda e cancelamento; remover da caixa (idempotente; acima do alocado → 422); script corrige divergência e é idempotente.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + suíte 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `fix(inventory): keep box allocations within lot balance and allow removing from boxes`

### Task 3: Banco de testes separado e backup (spec §6–7)

**Files:** `backend/package.json` scripts, bootstrap de teste (carrega `TEST_DATABASE_URL`, guarda de nome), `backend/src/scripts/prepareTestDb.ts`, `.github/workflows/ci.yml`, `backend/scripts/{backup-db.sh,restore-db.sh}`, README.
- [ ] **Step 1: Testes (falhando)** — guarda aborta com banco que não termina em `_test`; prepare cria e migra (idempotente).
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar; preparar `inventory_test` local; rodar a suíte inteira nele 3×; gerar um backup do banco de dev e restaurar num banco descartável (`inventory_restore_check`), conferir contagens, apagar o descartável.**
- [ ] **Step 4: Commit** — `chore: dedicated test database, guard against dev DB, backup and restore scripts`
