# Onda 9 — Acabamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os Baixos abertos da revisão geral e os menores adiados das ondas, sem mudar regras de negócio.

**Architecture:** Correções pontuais por módulo; duas migrations aditivas (escala de custo, `Restrict` no histórico financeiro, índice de movimentação); ferramentas de QA visual versionadas.

**Tech Stack:** Fastify 5, Prisma 6, `node:test`; React 19, Tailwind (tokens), Vitest + MSW; Chrome headless.

**Spec:** `docs/superpowers/specs/2026-10-26-wave9-polish-design.md` (itens com `arquivo:linha` em `docs/reviews/2026-10-25-revisao-geral.md` e `docs/HISTORICO.md` "Pendências")

## Global Constraints

- Branch `fix/wave9-polish`; `git add` com caminhos explícitos. Leia `CLAUDE.md` (regras absolutas do banco, convenções).
- Nenhuma regra de negócio muda; item que exigir decisão → relatar, não implementar.
- Nenhuma dependência nova (remover mortas é permitido).
- CI verde. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Migration de escala de custo não altera nenhum valor existente além de acrescentar casas; custo médio continua igual nos testes de estoque/NF-e — Task 1.
2. `Restrict` no histórico financeiro não quebra nenhum fluxo de exclusão existente (cliente, fornecedor, venda) — Task 1.
3. Remoção de dependências não quebra build/CI (scripts que as usavam) — Task 1.
4. A11y: nenhum campo com erro sem `aria-invalid`/`aria-describedby`; nenhum botão de ícone sem nome — Task 2.
5. Datas em listas/detalhes sempre dd/mm/aaaa independentemente do idioma do navegador — Task 2.

---

### Task 1: Backend (spec §1)
- [ ] Testes (falhando) por correção de comportamento; migrations; implementar; suítes 2×.
- [ ] Commit(s) por área — prefixo `fix(<área>):`/`chore:`

### Task 2: Frontend e ferramentas (spec §2)
- [ ] Testes (falhando) por correção; implementar; `tools/visual-qa/`; QA visual; suítes 2×.
- [ ] Commit(s) por área — prefixo `fix(frontend):`/`chore(tools):`
