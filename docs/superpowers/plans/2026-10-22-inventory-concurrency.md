# Concorrência de estoque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operações simultâneas na mesma variante nunca deixam saldo, lotes ou caixas inconsistentes.

**Architecture:** Trava pessimista (`SELECT … FOR UPDATE`) na linha do inventário da variante no início de cada use case de estoque, dentro da transação existente; `lock_timeout` por transação; deadlock/timeout → 409; restrição única de lote por variante.

**Tech Stack:** Fastify 5, Prisma 6 (PostgreSQL), `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-inventory-concurrency-design.md`

## Global Constraints

- Branch `feat/inventory-concurrency`. `git add` com caminhos explícitos.
- Acesso a banco só via `getDb()`; SQL bruto só em repositórios/infra (`$queryRaw`/`$executeRaw` com parâmetros — nunca interpolação de strings de entrada).
- Erro de disputa: 409 `{ message: "Operação em andamento para este item. Tente novamente.", code: "CONCURRENT_UPDATE" }`.
- `lockTimeoutMs` padrão 5000 no `PrismaTransactionManager`.
- Migration aditiva: `npx prisma migrate dev --name inventory_lot_unique_batch`. Nunca aceitar reset do banco; se pedir reset/drift → parar (BLOCKED).
- Testes em paralelo: só ids rastreados; nunca deletar `tx-test-inventory@local`; prefixo `tx-test-`.
- tsc backend ≤ 176. Nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Variante sem inventário em Dispatch/Reserve/Adjust continua 404 (lock não cria inventário) — teste em Task 2.
2. Venda com dois itens da mesma variante (linhas repetidas) não trava em si mesma — teste em Task 2.
3. Erro de negócio após a trava (ex.: estoque insuficiente) libera a trava (rollback) e a próxima requisição prossegue — teste em Task 2.
4. Variante inexistente no primeiro receive não cria inventário órfão (FK) e responde 404 — teste em Task 2.
5. Transação que não usa trava (queries, outros módulos) não é afetada pelo `lock_timeout` — teste em Task 1.

---

### Task 1: Infra de trava, timeout, mapeamento de erros e migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (`@@unique([productVariantId, batchNumber])` em `InventoryLot`) + migration gerada
- Modify: `backend/src/shared/infrastructure/prisma/PrismaTransactionManager.ts` (`lockTimeoutMs` + `SET LOCAL lock_timeout`)
- Modify: `backend/src/shared/http/errorHandler.ts` (409 `CONCURRENT_UPDATE` para deadlock/lock timeout)
- Modify: `backend/src/shared/domain/errors/errorCodes.ts` (`CONCURRENT_UPDATE`; interno `LOCK_OUTSIDE_TRANSACTION`)
- Modify: `backend/src/modules/inventory/domain/repositories/InventoryRepository.ts`, `backend/src/modules/inventory/infrastructure/prisma/repositories/PrismaInventoryRepository.ts`, `backend/src/modules/inventory/application/__tests__/fakes.ts` (in-memory: lock = leitura normal; mesma semântica de criação/null)
- Test: `backend/src/modules/inventory/infrastructure/prisma/__tests__/inventoryLock.test.ts`, `backend/src/shared/http/__tests__/errorHandler.test.ts`

**Interfaces:**
- Produces: `lockByProductVariantId(productVariantId: string): Promise<Inventory>`; `lockExistingByProductVariantId(productVariantId: string): Promise<Inventory | null>`; `new PrismaTransactionManager({ timeout?, maxWait?, lockTimeoutMs? })`.

- [ ] **Step 1: Testes (falhando)**

```ts
test("lock fora de transação lança InternalInvariantError")
test("lockByProductVariantId cria inventário vazio se não existe e retorna o existente se existe")
test("lockExisting… retorna null sem criar quando não existe")
test("trava segura a 2ª transação até o commit da 1ª")   // tx1 trava e espera 300ms; tx2 trava; tx2 só obtém depois (tempo ≥ 250ms) e lê o valor gravado por tx1
test("lockTimeoutMs curto + trava segurada → rejeita e o handler responde 409 CONCURRENT_UPDATE") // tm2 = new PrismaTransactionManager({ lockTimeoutMs: 200 }); capturar o erro real e passar por app.inject numa rota de teste OU testar o mapeamento com o erro capturado
test("transação sem trava não é afetada pelo lock_timeout")  // Review Focus 5: query normal numa linha não travada conclui
test("lote duplicado (variante+batchNumber) → P2002")
test("handler: P2034 → 409 CONCURRENT_UPDATE; P2010 meta.code 40P01/55P03 → 409")
```

- [ ] **Step 2: Ver falhar.** `cd backend && npx tsx --test src/modules/inventory/infrastructure/prisma/__tests__/inventoryLock.test.ts src/shared/http/__tests__/errorHandler.test.ts`
- [ ] **Step 3: Implementar** (SQL parametrizado via `Prisma.sql`/tagged template; confirmar a forma real do erro de lock timeout/deadlock e mapear exatamente essa forma; registrar no relatório).
- [ ] **Step 4: Migration** (comando das Global Constraints) → aplicada sem reset.
- [ ] **Step 5: Rodar** → PASS; `npm test` PASS.
- [ ] **Step 6: Commit** — `feat(inventory): row lock per variant, lock timeout and concurrent-update errors`

---

### Task 2: Use cases travados e ordem na venda

**Files:**
- Modify: `backend/src/modules/inventory/application/useCases/commands/{ReceiveInventoryUseCase,DispatchInventoryUseCase,ReserveInventoryUseCase,ReleaseInventoryUseCase,AdjustInventoryUseCase,AddProductToBoxUseCase,RemoveProductFromBoxUseCase,CreateProductVariantInventoryUseCase}.ts` (trava conforme tabela da spec; reler dados após a trava)
- Modify: `backend/src/modules/sales/application/useCases/commands/CreateSaleUseCase.ts` (itens em ordem crescente de `productVariantId`; itens repetidos da mesma variante não travam duas vezes de forma problemática — a mesma transação reentra na trava sem bloquear)
- Test: `backend/src/modules/inventory/application/useCases/__tests__/concurrency.test.ts` (use cases reais + `PrismaTransactionManager` + dev DB), `backend/src/modules/sales/application/useCases/commands/__tests__/CreateSaleOrdering.test.ts` (unitário com fakes)

**Interfaces:**
- Consumes: Task 1.

- [ ] **Step 1: Testes (falhando)**

```ts
test("dois dispatch de 4 com saldo 5 → exatamente um INSUFFICIENT_STOCK; saldo 1; soma lotes = saldo")
test("5 receives simultâneos de 3 no mesmo batch → 1 lote com 15, saldo 15, movimentações encadeadas")
test("primeiro receive simultâneo de variante nova → 1 inventário")
test("dois AddProductToBox que juntos excedem o lote → exatamente um BOX_LIMIT_EXCEEDED; alocado ≤ restante")
test("reserve concorrente acima do disponível → um recusado; reservado ≤ saldo")
test("erro de negócio libera a trava: após um dispatch recusado, outro dispatch válido conclui")  // Review Focus 3
test("dispatch em variante sem inventário → NotFoundError, nenhum inventário criado")        // Review Focus 1
test("receive de variante inexistente → NotFoundError, nenhum inventário criado")            // Review Focus 4
test("CreateSale processa itens em ordem crescente de productVariantId")                    // unitário: ordem das chamadas a consumeStock
test("venda com dois itens da mesma variante conclui")                                      // Review Focus 2
```

- [ ] **Step 2: Ver falhar** (os de corrida falham contra o código atual — capturar evidência).
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS; `npm test` PASS 3 vezes seguidas; tsc ≤ 176.
- [ ] **Step 5: Commit** — `fix(inventory): lock variant row in stock use cases; ordered sale items`
