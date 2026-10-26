# Onda 7 — Regras de negócio decididas e NF-e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as 6 regras aprovadas pelo usuário e os achados médios restantes da NF-e.

**Architecture:** Permissões novas na matriz compartilhada (backend + espelho no frontend); documento de cliente com índice único parcial; validações de aceitação/consistência no parser e na confirmação da NF-e; estorno de importação como use case transacional com travas na ordem documentada.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, `node:test`; React 19, TanStack Query 5, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-26-wave7-business-rules-design.md`

## Global Constraints

- Branch `feat/wave7-business-rules`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Migration: `npm run backup-db` antes; SQL à mão; `migrate deploy` em dev e `inventory_test`; `generate`. Testes do backend no `inventory_test`.
- Códigos, mensagens e permissões exatamente como na spec; erros pelas classes de `@shared/domain/errors`; rotas de dinheiro/estoque com `idempotent()`.
- Frontend: só tokens de tema (o lint falha com cor crua); mobile e desktop sem regressão.
- Nenhuma dependência nova.
- CI verde: backend typecheck + testes; frontend lint 0, typecheck 0, testes, build.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. VENDEDOR edita nome/código de barras de uma variante sem tocar no preço (envio do mesmo preço) e não é bloqueado — Task 1.
2. Dois cadastros simultâneos com o mesmo CPF: um 201, outro 409 com a mensagem (não 500) — Task 1.
3. NF-e real com `nfeProc`/`protNFe` cStat 100 e destinatário igual a `COMPANY_CNPJ` passa; sem `COMPANY_CNPJ` em dev passa — Task 2.
4. Diferença de 5 centavos ajusta a última parcela e o contas a pagar fecha com o vNF; 6 centavos recusa — Task 2.
5. Estorno com uma venda concorrente do mesmo lote: um dos dois vence, nunca estoque negativo nem estorno parcial — Task 3.

---

### Task 1: Preço, documento do cliente, ajuste abaixo do reservado (spec §1, §2, §5)
- [ ] Testes (falhando) backend + frontend; migration `customer_document`; implementar; suítes 2×.
- [ ] Commit — `feat: admin-only sale price, unique customer CPF/CNPJ, refuse adjust below reserved`

### Task 2: Aceitação da NF-e, centavos e consistência (spec §3, §6, §7)
- [ ] Testes (falhando) com XMLs de fixture para cada recusa, tolerância 5/6 centavos, nItem repetido, lote renomeado com validade mantida, mapeamento vazio/conflitante; `COMPANY_CNPJ` no env (produção obrigatória); frontend mostra divergência; suítes 2×.
- [ ] Commit — `feat(nfe): accept only authorized purchase notes for the company, cents tolerance, safer lots and mappings`

### Task 3: Desfazer importação de NF-e (spec §4)
- [ ] Testes (falhando): estorno feliz (lotes, caixas, custo médio, contas a pagar, pedido, status `REVERTED`, chave reimportável); bloqueios (lote consumido, pagamento ativo); permissão; idempotência; corrida com venda; frontend botão/confirmação/bloqueio. Migration do status se necessário.
- [ ] Commit — `feat(nfe): revert a received NF-e import when nothing was used`
