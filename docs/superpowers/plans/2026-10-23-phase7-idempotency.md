# Fase 7 — Idempotência Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir efeitos duplicados (pagamentos, vendas, compras, recebimentos, movimentações) em reenvios, com `Idempotency-Key` registrada na mesma transação da operação.

**Architecture:** Wrapper de rota `idempotent(handler)` que abre a transação do `TransactionManager`, registra/consulta `IdempotencyRecord` (insert `ON CONFLICT DO NOTHING` + `FOR UPDATE`), executa o controller dentro dela (casos de uso aninhados entram na mesma transação), captura status e corpo e grava; frontend gera e reusa a chave por tentativa no hook de mutação.

**Tech Stack:** Fastify 5, Prisma 6, `node:test`; React 19, TanStack Query 5, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase7-idempotency-design.md`

## Global Constraints

- Branch `feat/phase7-idempotency`; `git add` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Única forma de diff: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` → SQL à mão → `npx prisma migrate deploy` → `npx prisma generate`.
- Lista de rotas cobertas, códigos e mensagens exatamente como na spec.
- Nenhuma regra de negócio muda: todas as suítes existentes continuam verdes (os testes existentes que chamam rotas cobertas passam a enviar o cabeçalho via helper).
- Testes paralelos: chaves aleatórias por teste; dados `tx-test-` rastreados.
- CI verde: backend typecheck 0; frontend lint 0 e typecheck 0.
- Nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Duas requisições de pagamento simultâneas com a mesma chave → um único pagamento, as duas respostas iguais — teste em Task 1.
2. Pagamento recusado (ex.: 422 excede o restante) não "queima" a chave: corrigir o valor com a mesma chave → recusado como chave reusada (corpo diferente) — e repetir o mesmo corpo depois de liberar saldo executa — teste em Task 1.
3. Replay devolve exatamente o status e o corpo originais (incl. 201) sem consultar/alterar nada — teste em Task 1.
4. Usuário diferente com a mesma chave não recebe a resposta de outro — teste em Task 1.
5. Reenvio no front após falha de rede usa a mesma chave; nova ação usa chave nova — teste em Task 2.

---

### Task 1: Backend — registro de idempotência e rotas cobertas

**Files:**
- Modify: `backend/prisma/schema.prisma` + migration (`IdempotencyRecord` com `@@unique([userId, method, route, key])`, índice em `createdAt`)
- Create: `backend/src/shared/http/idempotency/{idempotent.ts,requestHash.ts,PrismaIdempotencyStore.ts}`, script `backend/src/scripts/purgeIdempotency.ts` + `npm run purge-idempotency`
- Modify: as rotas cobertas (spec), helper de testes para enviar o cabeçalho nos testes existentes
- Test: `backend/src/shared/http/idempotency/__tests__/idempotency.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("rota coberta sem Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED (tabela com todas as rotas)")
test("mesma chave e corpo → 1 pagamento; segunda resposta igual (201) com Idempotent-Replayed")   // Review Focus 3
test("duas requisições simultâneas com a mesma chave → 1 efeito, respostas iguais")              // Review Focus 1
test("mesma chave, corpo diferente → 422 IDEMPOTENCY_KEY_REUSED")
test("operação que falha não grava a chave: mesma chave e mesmo corpo executa de novo")           // Review Focus 2
test("outro usuário com a mesma chave → executa (sem replay)")                                    // Review Focus 4
test("chave com formato inválido → 400; purge remove registros com mais de 24 h")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(api): idempotency keys on money and stock operations`

---

### Task 2: Frontend — chave por tentativa

**Files:**
- Create: `frontend/src/shared/utils/idempotencyKey.ts`
- Modify: `frontend/src/shared/hooks/useCrudMutation.ts` (opção `idempotent`), serviços/hooks das ações cobertas (vendas, cancelamento de venda, pagamentos e estornos, pedidos, recebimentos, cancelamento de pedido, confirmação de NF-e, movimentações de estoque)
- Test: `frontend/src/shared/hooks/__tests__/useCrudMutation.idempotency.test.tsx` + um teste por fluxo crítico (pagamento, venda)

- [ ] **Step 1: Testes (falhando)**
```tsx
test("mutação coberta envia Idempotency-Key")
test("erro de rede e nova tentativa com os mesmos dados → mesma chave")                            // Review Focus 5
test("após sucesso, a próxima ação envia chave nova; dados diferentes → chave nova")
test("registrar pagamento e criar venda enviam o cabeçalho")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test` 2×; lint 0; typecheck 0; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): idempotency keys reused across retries of the same action`
