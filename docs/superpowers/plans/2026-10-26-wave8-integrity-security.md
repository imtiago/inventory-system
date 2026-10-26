# Onda 8 — Integridade, catálogo e segurança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os últimos achados médios: regras no banco, edição sem atualização perdida, barcode, resumo/CSV financeiros, limites de login e sessão entre abas.

**Architecture:** Migration aditiva de CHECKs e índice único parcial com tradução de erro; correções pontuais nos repositórios de catálogo e leitura financeira; limitador de login com três chaves; listener de `storage` no store de sessão.

**Tech Stack:** Fastify 5, Prisma 6, `node:test`; React 19, zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-wave8-integrity-security-design.md`

## Global Constraints

- Branch `fix/wave8-integrity-security`; `git add` com caminhos explícitos.
- **Banco:** nunca `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, nem nada que apague/reinicie um banco. Migration: `PGCONTAINER=api_db_1 npm run backup-db` antes; SQL à mão; `migrate deploy` em dev e `inventory_test`; `generate`. Testes no `inventory_test`.
- Códigos e mensagens como na spec; nenhuma dependência nova; frontend só com tokens.
- CI verde. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A migration aplica no banco de dev com os dados atuais; nenhum fluxo existente (venda, cancelamento, estorno de NF-e, pagamento/estorno, ajuste) passa a violar um CHECK — Task 1.
2. Reimportar uma NF-e desfeita não colide com o índice único de origem — Task 1.
3. Duas edições simultâneas de uma variante (uma muda nome, outra código de barras) preservam as duas mudanças — Task 2.
4. Logout em uma aba desloga a outra; login de outro usuário em outra aba não mostra dados do anterior — Task 2.
5. Limite por conta não bloqueia o usuário legítimo depois do login certo (reset correto) — Task 2.

---

### Task 1: Integridade e financeiro (spec §1, §2, §5, §6)
- [ ] Conferir dados; testes (falhando); migration; tradução 23514; README banco legado; resumo por intervalo; CSV; suítes 2×.
- [ ] Commit — `fix: database checks for money and stock, unique active financial origin, due-range summary and sold-items CSV`

### Task 2: Catálogo e segurança (spec §3, §4, §7, §8)
- [ ] Testes (falhando); implementar; suítes 2× (backend e frontend).
- [ ] Commit — `fix: barcode limits and conflicts, no lost updates on catalog edits, layered login limits, session sync across tabs`
