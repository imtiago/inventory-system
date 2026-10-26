# Onda 5 — Regras de estoque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consumir estoque por validade (FEFO → mais antigo), impedir a venda de lote vencido e corrigir as regras de lote, contagem, reserva e leituras de estoque.

**Architecture:** Ordenação e filtro de vencidos no repositório de lotes (parâmetro explícito "incluir vencidos"); regras de entrada/contagem nos use cases do inventory; erros pelas classes de `@shared/domain/errors`; frontend só exibe os novos campos e mensagens.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, `node:test`; React 19, TanStack Query 5, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-25-wave5-stock-rules-design.md`

## Global Constraints

- Branch `feat/wave5-stock-rules`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Se precisar de migration: backup (`npm run backup-db`), SQL à mão, `migrate deploy` (dev e `inventory_test`), `generate`. Testes do backend no `inventory_test` (`npm test`; arquivo isolado `npx tsx --import ./src/test/bootstrap.ts --test <arquivo>`).
- Códigos e mensagens exatamente como na spec; data de negócio pelo helper existente (`todayInBusinessTz`).
- Nenhuma dependência nova.
- CI verde: backend typecheck + testes; frontend lint 0, typecheck 0, testes, build.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Lote que vence hoje é vendável; o que venceu ontem não (fuso America/Sao_Paulo, inclusive perto da meia-noite UTC) — Task 1.
2. Venda com vários itens em que só um item esbarra em vencidos: nada é gravado (transação inteira desfeita), mensagem aponta o item — Task 1.
3. Devolução/cancelamento de venda continua devolvendo aos lotes certos depois da mudança de ordem — Task 1.
4. Script de união de lotes de contagem preserva Σ quantidades, Σ alocações em caixas e movimentações; rodar duas vezes não muda nada — Task 2.
5. Liberação de reserva de um documento nunca consome a reserva de outro — Task 2.

---

### Task 1: FEFO e lote vencido (spec §1–2)
- [ ] Testes (falhando): ordem B→A→C; vencido ontem bloqueado / vence hoje liberado; `EXPIRED_STOCK_ONLY` com a mensagem e item; venda multi-item atômica; saída manual com `inventoryLotId` (vencido ok, lote de outro inventário 422/404); `expired` no detalhe e nos saldos em lote; frontend: "Vencido: n", lote marcado, mensagem no item da venda.
- [ ] Implementar; suítes 2×; frontend lint/typecheck/test/build.
- [ ] Commit — `feat(inventory): consume lots by expiration (FEFO) and block selling expired stock`

### Task 2: Lotes, contagem, reservas e leituras (spec §3–6)
- [ ] Testes (falhando): média ponderada do custo; `LOT_DATES_MISMATCH`; 3 leituras sem lote → 1 lote; script `merge-count-lots` (simulação não altera; `--apply` une; idempotente); `RELEASE_EXCEEDS_RESERVATION`; total filtrado das movimentações; `quantity` na consulta de caixa (+ frontend "Na caixa: n").
- [ ] Implementar; suítes 2×; frontend.
- [ ] Commit — `fix(inventory): weighted lot cost, one lot per count, reservations tied to documents, filtered totals and box quantities`
