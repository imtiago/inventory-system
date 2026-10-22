# Estoque Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o módulo de estoque (backend e frontend) funcionando de ponta a ponta, com saldos, lotes, custo médio, caixas e histórico de movimentações consistentes e testados.

**Architecture:** Toda entrada de estoque passa por `ReceiveInventoryUseCase`; saídas consomem lotes FIFO; caixas só distribuem saldo já recebido. Movimentações registram lote e saldos anterior/atual. O frontend espelha o contrato da API, testado com Vitest + Testing Library + MSW, e fixtures JSON compartilhadas garantem o contrato via teste de integração no backend.

**Tech Stack:** Backend Node 22, TS ESM, Fastify 5, Prisma 6, Zod 4, `node:test` via `tsx --test`. Frontend React 19, Vite 8, TanStack Query 5, axios, Vitest, Testing Library, MSW 2.

**Spec:** `docs/superpowers/specs/2026-10-22-inventory-phase1-design.md`

## Global Constraints

- Branch `feat/inventory-phase1`. Nunca stage `backend/src/modules/catalog/infrastructure/http/controllers/DeleteProductVariantController.ts`, `backend/src/modules/inventory/infrastructure/http/controllers/AddProductToBoxController.ts` (edições não commitadas do usuário — se a Task 6 precisar alterar `AddProductToBoxController.ts`, preserve as mudanças do usuário no arquivo e commit o arquivo inteiro, registrando isso no ledger) nem `frontend/frontend.zip`. Sempre `git add` com caminhos explícitos.
- Acesso a banco somente via `getDb()` (`@shared/infrastructure/prisma/transactionContext`). Use cases de escrita estendem `TransactionalUseCase`. Aplicação/domínio não importam `@prisma/client` nem `@shared/prisma`.
- Migration apenas aditiva (spec §1). Comando: `cd backend && npx prisma migrate dev --name inventory_movement_history`.
- `userId` de escrita vem de `request.user.sub`; nenhum schema de escrita aceita `userId`.
- Erros de validação Zod: status 400, `message` = issues formatadas `"<path>: <mensagem>"` unidas por `"; "`.
- Mensagem de limite da caixa, exata: `Quantidade excede o saldo do lote disponível para caixas (X).` onde X = `remainingQuantity − allocatedQuantity`.
- Mensagem final do assistente, exata: `<N> unidade(s) colocada(s) na caixa <código>.`
- Dados de teste no banco: nomes/códigos com prefixo `tx-test-`; cada teste de integração limpa o que criou.
- Baselines: backend `tsc` 255 erros (75 em `src/modules/inventory/`); frontend `tsc -b` 77 erros (34 no escopo de estoque). Ao final: backend sem erros novos e zero em `src/modules/inventory/`; frontend zero em `src/modules/inventory/**`, `src/modules/products/components/VariantStock.tsx`, `src/shared/services/api.ts` e total ≤ 43.
- Novas deps do frontend só as do spec §6 (devDependencies). Nenhuma dep nova no backend.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Receber de novo um lote com o mesmo `batchNumber` mas outro custo/validade: soma no lote existente, lote mantém `unitCost`/`expirationDate` originais, custo médio do inventário usa o custo novo — teste em Task 3.
2. Saída/reserva com parte do saldo reservada: só o disponível (`quantity − reserved`) pode sair; pedido acima falha sem gravar — teste em Task 4.
3. Lote distribuído em várias caixas: o limite de `AddProductToBox` soma todas as caixas — teste em Task 5.
4. Lote já totalmente em caixas no assistente: campo de quantidade desabilitado com aviso, não é possível confirmar — teste em Task 10.
5. Datas de validade só-data (`YYYY-MM-DD`) exibidas no fuso `America/Sao_Paulo` aparecem com o mesmo dia (sem voltar um dia) — teste em Task 9.

---

### Task 1: Migration e entidades de domínio

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `StockMovement`, enum `StockMovementType`, relação reversa em `InventoryLot`)
- Create: `backend/prisma/migrations/<timestamp>_inventory_movement_history/` (gerado)
- Modify: `backend/src/modules/inventory/domain/entities/InventoryLot.ts`, `StockMovement.ts`
- Test: `backend/src/modules/inventory/domain/__tests__/InventoryLot.test.ts`, `StockMovement.test.ts`
- Modify: `backend/package.json` script `test` — acrescentar glob `"src/modules/*/domain/**/*.test.ts"`

**Interfaces:**
- Produces:
  - `InventoryLot` props `{ id?, inventoryId, productVariantId, sourceType: InventoryLotSource, sourceId?, initialQuantity, remainingQuantity?, unitCost, batchNumber?, manufacturingDate?, expirationDate?, createdAt? }`; getters de mesmo nome; métodos `receive(q)`, `consume(q)`, `restore(q)`, `isEmpty()`, `isExpired(ref?)`.
  - `StockMovement` props `{ id?, inventoryId, productVariantId, type, origin, quantity, previousQuantity, currentQuantity, inventoryLotId?, averageCost?, originId?, userId?, notes?, createdAt? }` + getters.
  - `StockMovementType.RELEASE` existe no Prisma.

- [ ] **Step 1: Testes das entidades (falhando)**

```ts
// InventoryLot
test("receive soma initial e remaining")            // new lot(10) .receive(5) → initial 15, remaining 15
test("consume reduz remaining e recusa acima")       // consume(4) → 6; consume(7) throws
test("restore não ultrapassa initial")               // consume(4); restore(5) throws
test("remainingQuantity padrão = initialQuantity")
// StockMovement
test("IN exige current = previous + quantity")       // {IN, q 5, prev 10, cur 15} ok; cur 14 throws
test("OUT exige current = previous - quantity")
test("RESERVE e RELEASE exigem current = previous")
test("ADJUSTMENT exige quantity = |current - previous|") // prev 10 cur 7 q 3 ok; q 2 throws
test("userId é opcional")
```

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx tsx --test src/modules/inventory/domain/__tests__/*.test.ts` → FAIL.
- [ ] **Step 3: Implementar entidades** conforme Interfaces (remover `quantity`/`availableQuantity`/`addQuantity` do lote).
- [ ] **Step 4: Schema + migration** — no `StockMovement`: `inventoryLotId String?`, `inventoryLot InventoryLot? @relation(fields:[inventoryLotId], references:[id], onDelete: SetNull)`, `previousQuantity Int?`, `currentQuantity Int?`, `averageCost Decimal?`; em `InventoryLot`: `stockMovements StockMovement[]`; enum `RELEASE`. Rodar o comando de migration das Global Constraints. Expected: migration criada e aplicada, `prisma generate` executado.
- [ ] **Step 5: Rodar testes** → PASS; `npm test` → PASS.
- [ ] **Step 6: Commit** — `feat(inventory): movement history columns and aligned lot/movement entities`

---

### Task 2: Repositórios e mappers Prisma

**Files:**
- Modify: `backend/src/modules/inventory/domain/repositories/{InventoryRepository,InventoryLotRepository,InventoryBoxStockRepository}.ts`
- Modify: `backend/src/modules/inventory/infrastructure/prisma/mappers/{InventoryMapper,InventoryLotMapper,StockMovementMapper}.ts`
- Modify: `backend/src/modules/inventory/infrastructure/prisma/repositories/{PrismaInventoryLotRepository,PrismaInventoryBoxStockRepository,PrismaStockMovementRepository}.ts`
- Create: `backend/src/test/inventoryFixtures.ts` — `createTestVariant(): Promise<{ variantId, cleanup(): Promise<void> }>` (brand/category/product/variant `tx-test-`; `cleanup` apaga box stocks, movimentações, lotes, inventário, variante, produto, categoria, marca nessa ordem) e `getTestUserId(): Promise<string>` (`prisma.user.upsert` por email `tx-test-inventory@local`)
- Test: `backend/src/modules/inventory/infrastructure/prisma/__tests__/repositories.test.ts`

**Interfaces:**
- Consumes: entidades da Task 1.
- Produces: contratos da spec §3, incluindo `IInventoryBoxStockRepository.sumAllocatedByLot(inventoryLotId: string): Promise<number>`; `findAvailableByInventory` → `remainingQuantity > 0`, `createdAt asc`.

- [ ] **Step 1: Testes de integração (falhando)**

```ts
test("Inventory persiste e recarrega averageCost")      // create com averageCost 12.5 → findById.averageCost === 12.5
test("InventoryLot round-trip initial/remaining")
test("findAvailableByInventory ignora lotes vazios e ordena FIFO")
test("StockMovement persiste lote, saldos, custo, notes, originId")
test("StockMovement sem userId é gravado")               // userId undefined → não lança
test("InventoryBoxStock.findById inexistente retorna null")
test("sumAllocatedByLot soma todas as caixas")           // 2 caixas, 3 + 4 → 7; lote sem caixas → 0
```

- [ ] **Step 2: Rodar e ver falhar** — `npx tsx --test src/modules/inventory/infrastructure/prisma/__tests__/repositories.test.ts`.
- [ ] **Step 3: Implementar** contratos/mappers. `StockMovementMapper.toCreatePersistence` conecta `user` e `inventoryLot` só quando o id existe; `update` de movimentação usa um `toUpdatePersistence` (campos `notes`). `PrismaInventoryLotRepository` perde `findByProductVariantId`.
- [ ] **Step 4: Rodar** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** — `fix(inventory): repositories and mappers persist average cost, lots and full movement history`

---

### Task 3: ReceiveInventoryUseCase (entrada única)

**Files:**
- Create: `backend/src/modules/inventory/application/__tests__/fakes.ts` — `InMemoryInventoryRepository`, `InMemoryInventoryLotRepository`, `InMemoryStockMovementRepository`, `InMemoryInventoryBoxRepository`, `InMemoryInventoryBoxStockRepository` (implementam as interfaces da Task 2) e `FakeCatalogService` (`implements CatalogService`, construída com uma lista de variantes)
- Modify: `backend/src/modules/inventory/application/dto/InventoryDTO.ts` (`IReceiveInventoryInput`, `IReceiveInventoryOutput`)
- Modify: `backend/src/modules/inventory/application/useCases/commands/ReceiveInventoryUseCase.ts`
- Test: `backend/src/modules/inventory/application/useCases/commands/__tests__/ReceiveInventoryUseCase.test.ts`

**Interfaces:**
- Produces:
  - `IReceiveInventoryInput { productVariantId; quantity; unitCost; batchNumber?; manufacturingDate?: Date; expirationDate?: Date; origin: StockMovementOrigin; sourceType: InventoryLotSource; originReferenceId?; notes?; userId? }`
  - `IReceiveInventoryOutput { inventory: Inventory; lot: InventoryLot }`
  - Construtor: `(catalogService: CatalogService, inventoryRepository: IInventoryRepository, inventoryLotRepository: IInventoryLotRepository, stockMovementRepository: IStockMovementRepository, transactionManager: TransactionManager)`

- [ ] **Step 1: Testes (falhando)** — com fakes e `InMemoryTransactionManager`:

```ts
test("cria inventário quando não existe")
test("variante inexistente lança 'Variante não encontrada.'")
test("lote novo: saldo, lote e movimentação IN com prev 0 / cur 10")
test("custo médio ponderado")                    // 10 @ 5 + 10 @ 15 → averageCost 10
test("mesmo batchNumber soma no lote existente mantendo unitCost e validade originais") // Review Focus 1
test("sem batchNumber cria lotes separados")
test("movimentação registra inventoryLotId, averageCost, userId")
```

- [ ] **Step 2: Ver falhar.** `npx tsx --test src/modules/inventory/application/useCases/commands/__tests__/ReceiveInventoryUseCase.test.ts`
- [ ] **Step 3: Implementar** conforme spec §4 (linha Receive). Ajustar `package.json` test glob se necessário (já cobre `application/**`).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(inventory): ReceiveInventoryUseCase as single stock entry`

---

### Task 4: Dispatch, Reserve, Release, Adjust

**Files:**
- Modify: `backend/src/modules/inventory/application/useCases/commands/{DispatchInventoryUseCase,ReserveInventoryUseCase,ReleaseInventoryUseCase,AdjustInventoryUseCase}.ts`
- Modify: `backend/src/modules/inventory/application/dto/InventoryDTO.ts` (`IDispatchInventoryInput` sem `reason`, `userId?`; `IAdjustInventoryInput { productVariantId; countedQuantity; notes?; userId? }`; `IReserveInventoryInput`/`IReleaseInventoryInput` com `userId?`)
- Modify: `backend/src/modules/inventory/application/services/{InventoryService,InventoryApplicationService}.ts` — `consumeStock({productVariantId, quantity, originId?})` → Dispatch com `origin: SALE`
- Test: `backend/src/modules/inventory/application/useCases/commands/__tests__/{Dispatch,ReserveRelease,Adjust}.test.ts`

**Interfaces:**
- Consumes: fakes (Task 3).
- Produces: `DispatchInventoryUseCase.execute(input): Promise<StockMovement[]>`; `AdjustInventoryUseCase.execute(input): Promise<StockMovement | null>`; Reserve/Release → `Promise<StockMovement>`.

- [ ] **Step 1: Testes (falhando)**

```ts
test("dispatch consome FIFO e gera um OUT por lote")     // lotes 3 e 5, saída 6 → lote1 0, lote2 2, 2 movimentos, saldos 8→5→2
test("dispatch acima do disponível falha sem gravar")
test("dispatch respeita reservado")                     // qty 10 reserved 4, saída 7 falha; saída 6 ok  — Review Focus 2
test("reserve altera só reservado e registra RESERVE prev=cur")
test("release acima do reservado falha")
test("adjust sem diferença retorna null e não grava")
test("adjust para baixo consome FIFO e registra ADJUSTMENT q=|diff|")
test("adjust para cima cria lote MANUAL com custo médio atual")
test("consumeStock chama dispatch com origin SALE")
```

- [ ] **Step 2: Ver falhar.** `npx tsx --test "src/modules/inventory/application/useCases/commands/__tests__/*.test.ts"`
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** — `fix(inventory): FIFO dispatch, reserve/release and count-based adjust`

---

### Task 5: Caixas e leitura na caixa

**Files:**
- Modify: `backend/src/modules/inventory/application/useCases/commands/{AddProductToBoxUseCase,RemoveProductFromBoxUseCase,RegisterScannedProductUseCase}.ts`
- Modify: `backend/src/modules/inventory/application/dto/InventoryDTO.ts` (`IRegisterScannedProductInput` + `unitCost?`, `userId?`)
- Test: `backend/src/modules/inventory/application/useCases/commands/__tests__/{Box,RegisterScanned}.test.ts`

**Interfaces:**
- Consumes: `ReceiveInventoryUseCase` (Task 3), `sumAllocatedByLot` (Task 2).
- Produces: `RegisterScannedProductUseCase` construtor `(catalogService, receiveInventory: ReceiveInventoryUseCase, addProductToBox: AddProductToBoxUseCase, inventoryRepository, inventoryBoxRepository, transactionManager)`; `execute` → `{ boxId, boxCode, inventoryLotId, quantity }`.

- [ ] **Step 1: Testes (falhando)**

```ts
test("add recusa acima do saldo considerando todas as caixas") // lote 10, caixa A 6, add 5 na B → mensagem exata com X=4 — Review Focus 3
test("add não altera saldo do inventário nem do lote")
test("remove subtrai")
test("registerScanned recebe e coloca na caixa")
test("registerScanned sem unitCost usa custo médio atual")
test("registerScanned caixa inexistente falha sem receber")
```

- [ ] **Step 2: Ver falhar.** `npx tsx --test "src/modules/inventory/application/useCases/commands/__tests__/{Box,RegisterScanned}.test.ts"`
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** — `fix(inventory): box allocation limited by lot balance; scanned product via receive`

---

### Task 6: Camada HTTP, fixtures de contrato

**Files:**
- Modify: controllers em `backend/src/modules/inventory/infrastructure/http/controllers/` (todos de escrita usam `request.user?.sub`); rename `"CreateInventoryBoxController .ts"` → `CreateInventoryBoxController.ts`
- Modify: `CreateInventoryLotController.ts` → chama `ReceiveInventory` (`origin: INVENTORY`, `sourceType: MANUAL`), responde DTO de lote
- Modify: schemas em `backend/src/modules/inventory/interfaces/http/schemas/` (remover `userId`/`reason`; `adjust` com `countedQuantity`; `initial-count` com `unitCost?`; `createInventoryLot` com `expirationDate`/`manufacturingDate` `z.coerce.date()`)
- Create: `backend/src/shared/http/formatZodError.ts` — `formatZodError(error: ZodError): string`
- Modify: `GetInventoryByIdFactory.ts` (read repo); `InventoryLotReadMapper`, `InventoryLotDTO`, `PrismaInventoryLotReadRepository` (DTO da spec §5 com `allocatedQuantity`, `createdAt desc`, page/limit da query); `InventoryReadMapper`/`InventoryDTO` com `averageCost`
- Modify: `CreateProductVariantInventoryUseCase.ts` → estende `TransactionalUseCase`, depende de `CatalogService` (interface) e `IInventoryRepository`, método `handle`; `GenerateInventoryByProductVariandIdFactory.ts` e `CreateInventoryController.ts` ajustados (`execute`)
- Create: `GET /inventory/boxes` — `ListInventoryBoxesUseCase`, `ListInventoryBoxesController`, factory, rota em `inventoryBoxRoutes.ts`, `InventoryBoxReadRepository.list(pagination, { search? })`
- Delete: `ManagerCreateInventoryLotUseCase.ts`, `CreateInventoryLotUseCase.ts`, `CreateInventoryLotFactory.ts`, `CreateInventoryLotFactory1.ts`, `InventoryService_1.ts`, `interfaces/http/presenters/*`, `schemas/inventorySchemas.ts`, `schemas/createStockMovementSchema.ts`, e o teste `workflows/__tests__/ManagerCreateInventoryLotUseCase.test.ts`
- Create: `frontend/src/test/fixtures/inventory/{inventory,inventoryLot,inventoryBox,inventoryList,inventoryLotList,inventoryBoxList}.json`
- Test: `backend/src/modules/inventory/infrastructure/http/__tests__/inventoryHttp.test.ts` (via `app.inject` com JWT assinado por `JWT_SECRET` para `getTestUserId()`)

**Interfaces:**
- Consumes: use cases das Tasks 3–5.
- Produces: contrato HTTP da spec §5 e fixtures JSON (Task 8 consome).

- [ ] **Step 1: Testes (falhando)**

```ts
test("GET /inventory/:id retorna 200 com averageCost e productVariant")
test("POST /inventory/lots recebe estoque e retorna lote com remainingQuantity")
test("POST /inventory/lots grava manufacturingDate")
test("movimentação do POST /lots tem userId do token")
test("POST /inventory/ cria inventário com saldo 0 e recusa duplicado")
test("POST /inventory/boxes/:id/items acima do limite → 400 com mensagem exata")
test("GET /inventory/boxes?search filtra por código")
test("erro Zod retorna message legível")            // quantity -1 → /quantity: /
test("contrato: chaves de cada rota == fixtures do frontend") // compara recursivamente com frontend/src/test/fixtures/inventory/*.json
```

- [ ] **Step 2: Ver falhar.** `npx tsx --test src/modules/inventory/infrastructure/http/__tests__/inventoryHttp.test.ts`
- [ ] **Step 3: Implementar** (fixtures JSON escritas com valores realistas e exatamente as chaves dos DTOs da spec §5).
- [ ] **Step 4: Rodar** → PASS; `npm test` → PASS.
- [ ] **Step 5: Commit** — `fix(inventory): HTTP layer uses token user, receive-based lots, boxes list and contract fixtures`

---

### Task 7: Backend sem erros de tipo no estoque

**Files:** os arquivos de `backend/src/modules/inventory/**` apontados pelo `tsc` (mappers de leitura, queries, controllers, `__tests__/inventory.test.ts` legado — remover se for Jest e estiver quebrado).

- [ ] **Step 1:** `cd backend && npx tsc --noEmit -p . 2>&1 | grep "src/modules/inventory/"` → listar.
- [ ] **Step 2:** Corrigir cada erro sem mudar comportamento coberto pelos testes.
- [ ] **Step 3:** Mesmo comando → vazio; total ≤ 255 e sem erros novos fora do estoque (comparar com baseline); `npm test` → PASS.
- [ ] **Step 4: Commit** — `chore(inventory): zero type errors in backend inventory module`

---

### Task 8: Infra de testes do frontend, serviço e tipos

**Files:**
- Modify: `frontend/package.json` (devDeps: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `msw`; script `"test": "vitest run"`)
- Modify: `frontend/vite.config.ts` (`test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], env: { TZ: 'America/Sao_Paulo' } }`)
- Create: `frontend/src/test/setup.ts` (jest-dom, MSW `server.listen/resetHandlers/close`), `frontend/src/test/server.ts`, `frontend/src/test/handlers/inventory.ts` (usa as fixtures), `frontend/src/test/render.tsx` (`renderWithProviders(ui, { route? })` com `QueryClient` sem retry + `MemoryRouter`)
- Modify: `frontend/src/shared/services/api.ts` (`baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'`)
- Modify: `frontend/src/modules/inventory/services/inventoryService.ts`, `frontend/src/modules/inventory/types.ts` (fonte única dos tipos; `types/InitialInventoryTypes.ts` e `types/InventoryLotTypes.ts` reexportam ou são removidos)
- Create: `frontend/src/shared/react-query/keys.ts` entradas `inventory`, `inventoryById(id)`, `inventoryByVariant(variantId)`, `inventoryLots(variantId)`, `inventoryBoxes(search?)`
- Test: `frontend/src/modules/inventory/services/__tests__/inventoryService.test.ts`

**Interfaces:**
- Consumes: fixtures (Task 6).
- Produces (inventoryService): `getInventory(page)`, `getInventoryById(id)`, `getInventoryByVariant(variantId): Promise<Inventory | null>` (404 → null), `getInventoryLots(variantId, {page, limit})`, `createInventoryLot(dto): Promise<InventoryLot>`, `listInventoryBoxes(search?)`, `createInventoryBox()`, `addLotToBox(boxId, {inventoryLotId, quantity})`; tipos `Inventory`, `InventoryLot`, `InventoryBox`, `Paginated<T>`.

- [ ] **Step 1: Instalar deps** (versões compatíveis com Vite 8/React 19; registrar versões no ledger) e criar setup.
- [ ] **Step 2: Testes (falhando)**

```ts
test("getInventoryById retorna data do envelope")
test("getInventoryByVariant 404 → null; 500 → lança")
test("getInventoryLots envia page/limit e retorna Paginated<InventoryLot>")
test("createInventoryLot envia datas em ISO")
test("listInventoryBoxes envia search")
```

- [ ] **Step 3: Ver falhar.** `cd frontend && npx vitest run src/modules/inventory/services`
- [ ] **Step 4: Implementar.**
- [ ] **Step 5: Rodar** → PASS.
- [ ] **Step 6: Commit** — `test(frontend): vitest + MSW setup; inventory service aligned with API`

---

### Task 9: Detalhes, coluna de estoque e lista

**Files:**
- Modify: `frontend/src/modules/inventory/pages/InventoryDetailsPage.tsx`, `pages/InventoryListPage.tsx`, `hooks/useInventoryById.ts`, `hooks/useVariantInventory.ts`, `frontend/src/modules/products/components/VariantStock.tsx`
- Create: `frontend/src/modules/inventory/hooks/useInventoryLots.ts` (único hook de lotes; substitui `useInventoryLotsByVariant`)
- Create: `frontend/src/shared/utils/formatDateOnly.ts` — `formatDateOnly(iso: string | null): string` (formata em `pt-BR` com `timeZone: 'UTC'`; `null` → `"—"`)
- Test: `frontend/src/modules/inventory/pages/__tests__/InventoryDetailsPage.test.tsx`, `frontend/src/modules/products/components/__tests__/VariantStock.test.tsx`

**Interfaces:**
- Consumes: service/keys (Task 8).
- Produces: `useInventoryLots(variantId?: string, opts?: {page?, limit?})` → `{ lots, pagination, isLoading, error }`.

- [ ] **Step 1: Testes (falhando)**

```tsx
test("detalhes mostram saldo, reservado, disponível e custo médio")
test("tabela de lotes mostra recebido, restante, em caixas, custo e validade")
test("validade 2026-12-31T00:00:00.000Z aparece como 31/12/2026") // Review Focus 5 (TZ São Paulo)
test("VariantStock mostra disponível")
test("VariantStock sem inventário mostra 'Sem estoque'")
test("lista não mostra 'undefined' durante o carregamento")
```

- [ ] **Step 2: Ver falhar.** `cd frontend && npx vitest run src/modules/inventory/pages/__tests__/InventoryDetailsPage.test.tsx src/modules/products/components/__tests__/VariantStock.test.tsx`
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `fix(frontend): inventory details, variant stock column and list loading`

---

### Task 10: Assistente de inventário inicial

**Files:**
- Modify: `frontend/src/modules/inventory/hooks/useInitialInventoryFlow.ts`, `pages/InitialInventoryPage.tsx`, `components/{InitialInventoryLotStep,InitialInventoryBoxStep,InitialInventoryLabelChoice,InitialInventoryLabelQuantity,InitialInventoryProductSelection,ProductVariantRegistration,InventoryLotForm}.tsx`, `hooks/{useProductByBarcode,useInventoryBox,useInventoryBoxByLot,useGenerateInventoryProductLabels}.ts`
- Test: `frontend/src/modules/inventory/pages/__tests__/InitialInventoryPage.test.tsx`

**Interfaces:**
- Consumes: service/hooks (Tasks 8–9).
- Produces: `FlowStep` sem mudança de nomes; `handleNewLotSuccess(lot: InventoryLot)`; `handleAddToBox(quantity: number)`; `handleBackToLot()`; `useProductByBarcode` expõe `error`.

O `BarcodeScanner` (html5-qrcode) é substituído nos testes por `vi.mock` que expõe um botão chamando `onScan("7891234567890")`.

- [ ] **Step 1: Testes (falhando)**

```tsx
test("caminho feliz: lê código → cria lote → escolhe caixa existente → 3 unidades → '3 unidade(s) colocada(s) na caixa B000001.'")
test("erro 500 na leitura mostra erro e não abre 'produto não encontrado'")
test("quantidade da caixa limitada a remaining − allocated")
test("lote totalmente em caixas desabilita quantidade e confirmação") // Review Focus 4
test("voltar da caixa para o lote mantém o lote selecionado")
test("fechar modal de busca de produto volta ao passo anterior (sem tela vazia)")
test("sem código de barras: escolher produto lista variantes existentes")
test("não exibe prompt 'criar inventário'")
test("mutações invalidam lotes e caixas")              // após addLotToBox, refetch de lots
test("quantidade de etiquetas pode ser apagada e valida no envio")
```

- [ ] **Step 2: Ver falhar.** `cd frontend && npx vitest run src/modules/inventory/pages/__tests__/InitialInventoryPage.test.tsx`
- [ ] **Step 3: Implementar** conforme spec §6 (assistente).
- [ ] **Step 4: PASS;** `npm test` → PASS.
- [ ] **Step 5: Commit** — `fix(frontend): initial inventory wizard works end to end`

---

### Task 11: Limpeza, tipos, build e roteiro real

**Files:**
- Delete: arquivos listados na spec §6 "Limpeza"; remover `console.log` de depuração do módulo; remover rota/import de `StockEntryPage` se existir.
- Create: `backend/scripts/inventory-smoke.ts` — executa, contra `http://localhost:3000` com JWT do usuário de teste, a mesma sequência do assistente: `GET /variants/barcode/:code` → `POST /inventory/lots` → `GET /inventory/variants/:id/lots` → `POST /inventory/boxes` → `GET /inventory/boxes?search` → `POST /inventory/boxes/:id/items` (dentro e acima do limite) → `GET /inventory/:id`; imprime cada status e verifica saldos; cria e limpa uma variante `tx-test-` com código de barras próprio.

- [ ] **Step 1:** `cd frontend && npx tsc -b --pretty false 2>&1 | grep "error TS" | grep -E "src/modules/inventory/|VariantStock|shared/services/api"` → corrigir até vazio; total ≤ 43.
- [ ] **Step 2:** `npx vite build` → sucesso; `npm test` → PASS.
- [ ] **Step 3:** Subir backend (`cd backend && npx tsx src/server.ts`), rodar `npx tsx scripts/inventory-smoke.ts` → todos os passos com status esperado (o acima-do-limite → 400); parar o servidor.
- [ ] **Step 4:** `cd backend && npm test` → PASS.
- [ ] **Step 5: Commit** — `chore(inventory): remove dead code, zero type errors, smoke script`
