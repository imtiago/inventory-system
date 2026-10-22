# TransactionManager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar atômicas as escritas dos use cases transacionais, com transação propagada implicitamente e sem referências ao Prisma nas camadas de aplicação e domínio.

**Architecture:** Unit of Work com `AsyncLocalStorage`. `PrismaTransactionManager` abre `prisma.$transaction` e guarda o client da transação no contexto; repositórios obtêm o client via `getDb()` (transação ativa ou client global). Chamadas aninhadas reaproveitam a transação externa.

**Tech Stack:** Node 22, TypeScript (ESM), Fastify, Prisma 6, `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-transaction-manager-design.md`

## Global Constraints

- Todos os caminhos abaixo são relativos a `backend/`. Comandos rodam em `backend/`.
- Módulos `src/modules/purchases/**` e `src/modules/nfe-import/**` **não** são alterados.
- Nenhum arquivo em `src/modules/*/application/**`, `src/modules/*/domain/**`, `src/shared/application/**` ou `src/shared/domain/**` importa `@prisma/client` ou `@shared/prisma` ao final do plano. Única exceção pré-existente e fora de escopo: `SaleStatus` em `src/modules/sales/domain/repositories/SaleRepository.ts` (o import de `Prisma` sai; o de `SaleStatus` fica).
- `PrismaTransactionManager` padrão: `timeout: 10000`, `maxWait: 2000` (ms).
- Nenhuma dependência nova no `package.json`.
- Baseline de `npx tsc --noEmit -p .`: **266** erros (salvo em scratchpad). Ao final: total ≤ 266 e nenhum erro mencionando `TransactionClient`, `TransactionManager` ou `handle`.
- Não corrigir bugs funcionais fora do escopo da spec (ex.: `save`/`findByVariant` inexistentes no inventory) — apenas manter as chamadas como estão, sem o argumento `tx`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Duas requisições concorrentes (dois `execute` em paralelo) não podem compartilhar o client de transação — teste em Task 1.
2. Após um `execute` terminar (sucesso ou erro), `getDb()` volta a retornar o client global — o contexto não vaza — teste em Task 1.
3. Trabalho que excede o `timeout` deve rejeitar e não deixar nada gravado — teste em Task 1.
4. O erro lançado dentro do `execute` chega ao chamador como a mesma instância (controllers dependem da mensagem) — teste em Task 1.
5. Um repositório real usado dentro de um use case transacional participa da transação (o bug original) — teste em Task 3.

---

### Task 1: Núcleo do TransactionManager

**Files:**
- Modify: `src/shared/application/transaction/TransactionManager.ts`
- Create: `src/shared/infrastructure/prisma/transactionContext.ts`
- Modify: `src/shared/infrastructure/prisma/PrismaTransactionManager.ts`
- Create: `src/shared/application/transaction/InMemoryTransactionManager.ts`
- Delete: `src/shared/infrastructure/database/prisma/PrismaTransactionManager.ts` (sem usos)
- Test: `src/shared/infrastructure/prisma/__tests__/PrismaTransactionManager.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `interface TransactionManager { execute<T>(work: () => Promise<T>): Promise<T> }` em `@shared/application/transaction/TransactionManager`
  - `getDb(): Prisma.TransactionClient` e `runInTransactionContext<T>(tx: Prisma.TransactionClient, work: () => Promise<T>): Promise<T>` e `hasActiveTransaction(): boolean` em `@shared/infrastructure/prisma/transactionContext`
  - `class PrismaTransactionManager implements TransactionManager`, `constructor(options?: { timeout?: number; maxWait?: number })`
  - `class InMemoryTransactionManager implements TransactionManager` — `execute = work => work()`

- [ ] **Step 1: Atualizar script de teste**

`package.json` → `"test": "tsx --test \"src/shared/**/*.test.ts\" \"src/modules/*/application/**/*.test.ts\" \"src/modules/*/infrastructure/**/*.test.ts\""`. O glob exclui de propósito o teste Jest legado `src/modules/inventory/__tests__/inventory.test.ts`.

- [ ] **Step 2: Escrever os testes de integração (falhando)**

Fixture: marcas com nome `tx-test-${randomUUID()}`; `after()` faz `prisma.brand.deleteMany({ where: { name: { startsWith: "tx-test-" } } })` e `prisma.$disconnect()`. Escritas dentro do `execute` usam `getDb().brand.create(...)`; asserções fora usam `prisma` global.

```ts
test("rollback: erro após escrita não deixa registro", ...)
  // execute(async () => { await getDb().brand.create({data:{name}}); throw err })
  // assert.rejects(..., err)  -> mesma instância (assert.equal(caught, err))
  // assert.equal(await prisma.brand.count({where:{name}}), 0)

test("commit: sem erro o registro existe", ...)  // count === 1

test("aninhado reaproveita a transação", ...)
  // outer: db1 = getDb(); create A; await tm.execute(async () => { assert.equal(getDb(), db1); create B; throw err })
  // após: count A === 0 && count B === 0

test("fora de execute, getDb() é o client global", ...)
  // assert.equal(getDb(), prisma) antes; depois de um execute resolvido; depois de um execute rejeitado

test("execuções concorrentes não compartilham contexto", ...)
  // Promise.all de dois execute que capturam getDb() após `await new Promise(r=>setTimeout(r,50))`
  // assert.notEqual(dbA, dbB); assert.notEqual(dbA, prisma)

test("timeout rejeita e desfaz", ...)
  // new PrismaTransactionManager({ timeout: 200 })
  // execute(async () => { create; await sleep(500) }) rejeita; count === 0
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx tsx --test src/shared/infrastructure/prisma/__tests__/PrismaTransactionManager.test.ts`
Expected: FAIL (import de `transactionContext` inexistente).

- [ ] **Step 4: Implementar**

- `transactionContext.ts`: um `AsyncLocalStorage<Prisma.TransactionClient>` de módulo; `getDb()` retorna `storage.getStore() ?? prisma`.
- `PrismaTransactionManager.execute`: se `hasActiveTransaction()` → `return work()`; senão `prisma.$transaction(tx => runInTransactionContext(tx, work), { timeout, maxWait })`.
- Interface em `shared/application/transaction/TransactionManager.ts` com a assinatura acima.

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: o mesmo comando do Step 3. Expected: 6 testes PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json src/shared
git commit -m "feat(shared): AsyncLocalStorage-based PrismaTransactionManager"
```

---

### Task 2: Use cases e serviços sem `tx`

**Files:**
- Modify: `src/shared/application/useCases/TransactionalUseCase.ts`
- Modify: `src/shared/domain/UseCase.ts` — `execute(request: Request): Promise<Response>`
- Delete: `src/shared/domain/TransactionManager.ts`
- Modify: todos os imports `@shared/domain/TransactionManager` → `@shared/application/transaction/TransactionManager` (fora de purchases/nfe-import), e `"../../domain/TransactionManager"` em `PrismaTransactionManager.ts`
- Modify: todos os use cases listados em `grep -rl TransactionClient src/modules/*/application` (exceto purchases)
- Modify: `src/modules/inventory/application/services/{InventoryService,InventoryApplicationService}.ts`, `src/modules/finance/application/services/{FinacialService,FinancialApplicationService}.ts`
- Modify: `src/modules/inventory/application/useCases/queries/{GetInventoryDashboardUseCase,GetInventoryLotsByVariantIdUseCase}.ts`
- Test: `src/shared/application/useCases/__tests__/TransactionalUseCase.test.ts`

**Interfaces:**
- Consumes: `TransactionManager`, `InMemoryTransactionManager` (Task 1)
- Produces:
  - `abstract class TransactionalUseCase<Req, Res>`: `execute(request: Req): Promise<Res>`; `protected abstract handle(request: Req): Promise<Res>`
  - `InventoryService.consumeStock(request: ConsumeStockRequest): Promise<void>`
  - `FinancialService.createReceivable(input: CreateFinancialServicenput): Promise<void>`
  - `GetInventoryDashboardUseCase.execute(): Promise<InventoryDashboardDTO>`; `GetInventoryLotsByVariantIdUseCase.execute(request): Promise<...>` (sem `transactionManager` no construtor)

- [ ] **Step 1: Teste unitário (falhando)**

```ts
test("execute delega handle ao transactionManager", ...)
  // spy manager conta chamadas e chama work(); subclasse concreta retorna request*2
  // assert.equal(await uc.execute(21), 42); assert.equal(spy.calls, 1)
test("execute não aceita segundo argumento", ...) // garantido por tipo: handle.length === 1
```

- [ ] **Step 2: Rodar e confirmar falha** — `npx tsx --test src/shared/application/useCases/__tests__/TransactionalUseCase.test.ts` → FAIL (`handle.length` é 2).

- [ ] **Step 3: Implementar `TransactionalUseCase` e `UseCase`** conforme Interfaces; remover import de `@prisma/client`.

- [ ] **Step 4: Rodar e confirmar sucesso** — mesmo comando → PASS.

- [ ] **Step 5: Migrar use cases e serviços (mecânico)**

Em cada arquivo: `handle(request, tx: Prisma.TransactionClient)` → `handle(request)`; remover o argumento `tx` de toda chamada a repositório/serviço/use case; remover `import { Prisma } from "@prisma/client"` quando sobrar sem uso; trocar import do `TransactionManager`. Nos serviços, remover `tx?` da interface e da implementação. As duas queries deixam de estender `TransactionalUseCase`. **Não** tocar em `CancelSaleUseCase` e `ManagerCreateInventoryLotUseCase` além do `handle`/imports — o corpo deles é Task 4.

- [ ] **Step 6: Atualizar factories das duas queries** — remover o `PrismaTransactionManager` passado ao construtor (`grep -rln "GetInventoryDashboardUseCase\|GetInventoryLotsByVariantIdUseCase" src/modules/inventory/infrastructure`).

- [ ] **Step 7: Verificar**

Run: `grep -rln "TransactionClient\|@shared/domain/TransactionManager" src --include=*.ts | grep -v purchases | grep -v nfe-import | grep -v /infrastructure/ | grep -v /domain/repositories/`
Expected: vazio.
Run: `npx tsc --noEmit -p . 2>&1 | grep -c "error TS"` → ≤ 266.

- [ ] **Step 8: Commit** — `refactor: remove tx parameter from use cases and services`

---

### Task 3: Repositórios via `getDb()`

**Files:**
- Modify: todos os `Prisma*Repository.ts` em `src/modules/{auth,catalog,customer,finance,inventory,sales}/infrastructure/prisma/{repositories,contracts}/` e `src/shared/infrastructure/repositories/PrismaNumberRangeRepository.ts`
- Modify: interfaces de domínio com `tx?`: `src/modules/inventory/domain/repositories/*.ts`, `src/modules/sales/domain/repositories/SaleRepository.ts`, `src/shared/domain/repositories/NumberRangeRepository.ts`
- Modify: factories que fazem `new Prisma*Repository(prisma)` (15 arquivos; `grep -rln "Repository(prisma)" src | grep -v purchases`)
- Test: `src/modules/catalog/infrastructure/prisma/__tests__/PrismaBrandRepository.tx.test.ts`

**Interfaces:**
- Consumes: `getDb()` (Task 1), `PrismaTransactionManager` (Task 1)
- Produces: repositórios sem parâmetro `tx` e sem `PrismaClient` no construtor (construtor vazio).

- [ ] **Step 1: Teste (falhando)**

```ts
test("repositório participa da transação", ...)
  // const repo = new PrismaBrandRepository(); const tm = new PrismaTransactionManager()
  // await assert.rejects(tm.execute(async () => { await repo.create(new Brand({ name })); throw err }))
  // assert.equal(await prisma.brand.count({ where: { name } }), 0)
```
Mesma fixture/cleanup `tx-test-` da Task 1.

- [ ] **Step 2: Rodar e confirmar falha** — `npx tsx --test src/modules/catalog/infrastructure/prisma/__tests__/PrismaBrandRepository.tx.test.ts` → FAIL (count 1).

- [ ] **Step 3: Migrar repositórios**

Regras: `prisma.` (global) → `getDb().`; `this.prisma.` → `getDb().`; parâmetros `tx: Prisma.TransactionClient = prisma` / `tx?` removidos e `tx.` → `getDb().`; construtores `(private readonly prisma: PrismaClient)` removidos; remover imports de `@shared/prisma`/`PrismaClient` sem uso. Remover `tx?` das interfaces de domínio listadas.

- [ ] **Step 4: Atualizar factories** — `new PrismaXRepository(prisma)` → `new PrismaXRepository()`; remover import de `@shared/prisma` sem uso.

- [ ] **Step 5: Verificar**

Run: o teste do Step 2 → PASS. Run: `npm test` → tudo PASS.
Run: `grep -rln "@shared/prisma\|TransactionClient" src --include=*.ts | grep -v purchases | grep -v nfe-import` → somente `src/shared/prisma.ts`, `src/shared/infrastructure/prisma/*` e arquivos de teste.

- [ ] **Step 6: Commit** — `refactor: repositories resolve client via getDb()`

---

### Task 4: CancelSale e ManagerCreateInventoryLot

**Files:**
- Modify: `src/modules/sales/application/useCases/commands/CancelSaleUseCase.ts`
- Modify: `src/modules/inventory/application/useCases/workflows/ManagerCreateInventoryLotUseCase.ts`
- Test: `src/modules/inventory/application/useCases/workflows/__tests__/ManagerCreateInventoryLotUseCase.test.ts`

**Interfaces:**
- Consumes: `TransactionalUseCase`, `InMemoryTransactionManager`

- [ ] **Step 1: Teste (falhando)**

```ts
test("lança quando inventory não existe e não cria lote", ...)
  // getInventoryByIdUseCase fake retorna null; createInventoryLotUseCase fake registra chamadas
  // await assert.rejects(uc.execute(input), /Inventory not found/)
  // assert.equal(createCalls, 0)
```

- [ ] **Step 2: Rodar e confirmar falha** → FAIL (hoje só faz `console.log`).

- [ ] **Step 3: Implementar**
- Manager: `if (!inventory) throw new Error("Inventory not found")`; remover `console.log` e a variável `lot` não usada.
- CancelSale: remover `prisma.$transaction` e import de `@shared/prisma`; corpo direto no `handle`; remover as chamadas `tx.receivable.updateMany` e `tx.receivableParcel.updateMany`; no lugar: `// TODO: cancelar documento financeiro via FinancialService (models receivable/receivableParcel não existem mais)`.

- [ ] **Step 4: Verificar** — teste PASS; `grep -n "prisma\|receivable\b" src/modules/sales/application/useCases/commands/CancelSaleUseCase.ts` → só a linha do TODO.

- [ ] **Step 5: Verificação final**
Run: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | wc -l` → ≤ 266.
Run: `npx tsc --noEmit -p . 2>&1 | grep -iE "TransactionClient|TransactionManager|handle" | grep -v purchases | grep -v nfe-import` → vazio.
Run: `grep -rln "@prisma/client\|@shared/prisma" src/modules/*/application src/modules/*/domain src/shared/application src/shared/domain | grep -v purchases | grep -v nfe-import` → somente `SaleRepository.ts` (import de `SaleStatus`).
Run: `npm test` → PASS.

- [ ] **Step 6: Commit** — `fix: CancelSale and ManagerCreateInventoryLot run inside caller transaction`
