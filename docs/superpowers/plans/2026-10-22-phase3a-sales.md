# Fase 3A — Vendas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Venda com preço real, parcelas corretas no contas a receber, cancelamento que devolve estoque e cancela o financeiro, e telas de venda funcionais.

**Architecture:** Preço na variante; dinheiro em centavos; plano de parcelas como função pura de domínio; criação e cancelamento numa transação com travas de estoque; financeiro acionado por `FinancialService`; frontend espelha o contrato `{ data }`.

**Tech Stack:** Backend Fastify 5, Prisma 6 (PostgreSQL), Zod 4, `node:test`. Frontend React 19, Vite 8, TanStack Query 5, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-22-phase3a-sales-design.md`

## Global Constraints

- Branch `feat/phase3a-sales`; `git add` com caminhos explícitos.
- Acesso a banco só via `getDb()`; SQL bruto só em repositórios e parametrizado.
- Erros: classes de `@shared/domain/errors`; mensagens PT; códigos novos em `errorCodes.ts`: `VARIANT_WITHOUT_PRICE`, `SALE_HAS_PAYMENTS`. Controllers sem `catch`; entrada via `parseInput`.
- Respostas de sucesso `{ data }` / `{ data, pagination }`.
- Dinheiro em centavos inteiros em todo cálculo; `Decimal` só na persistência.
- Migration aditiva: escrever SQL à mão após `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` mostrar só as mudanças esperadas; aplicar com `npx prisma migrate deploy`; nunca reset (se drift/reset → BLOCKED).
- Testes em paralelo: só ids rastreados; nunca deletar `tx-test-inventory@local`; prefixo `tx-test-`; cleanups independentes com `$disconnect` em `finally`.
- tsc backend ≤ 176; frontend `tsc -b` ≤ 43; nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Parcelas somam exatamente o total também com valores que não dividem (ex.: R$ 100,00 em 3x; R$ 0,05 em 3x) — teste em Task 2.
2. `firstDueDate` em dia 29/30/31 gera vencimentos válidos em fevereiro e meses de 30 dias — teste em Task 2.
3. Falha no financeiro durante a criação desfaz a venda e o estoque (atomicidade) — teste em Task 2.
4. Cancelar venda cujo estoque saiu de vários lotes devolve a cada lote exatamente o que saiu dele — teste em Task 3.
5. Variante sem preço no carrinho bloqueia o envio na tela (e o backend recusa com 422) — teste em Task 4.

---

### Task 1: Preço da variante e vendedor (banco + catálogo)

**Files:**
- Modify: `backend/prisma/schema.prisma` (`ProductVariant.salePrice`, `Sale.sellerId` + relação `User`) + migration `<timestamp>_sales_price_and_seller`
- Create: `backend/src/shared/domain/money.ts` (`toCents`, `fromCents`) + teste
- Modify: catálogo — mapper Prisma de variante (`backend/src/modules/catalog/infrastructure/prisma/mappers/ProductVariantMapper.ts` ou equivalente), schemas de criar/atualizar variante, read mapper/DTO (`salePrice: number`)
- Test: `backend/src/shared/domain/__tests__/money.test.ts`, `backend/src/modules/catalog/infrastructure/http/__tests__/variantPrice.test.ts`

**Interfaces:**
- Produces: `toCents(value: number): number` (arredonda para o centavo mais próximo), `fromCents(cents: number): number`; variante com `salePrice` persistido e exposto.

- [ ] **Step 1: Testes (falhando)**
```ts
test("toCents(10.005) === 1001; toCents(0.1 + 0.2) === 30; fromCents(1001) === 10.01")
test("POST /products/:id/variants com salePrice 19.9 → GET mostra salePrice 19.9")
test("salePrice negativo → 400 VALIDATION_ERROR field salePrice")
test("update de variante altera salePrice")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration.** - [ ] **Step 4: PASS + `npm test`.**
- [ ] **Step 5: Commit** — `feat(catalog): variant sale price; sale seller column; money helpers`

---

### Task 2: Criação e leitura da venda

**Files:**
- Create: `backend/src/modules/sales/domain/services/InstallmentPlan.ts`
- Modify: `backend/src/modules/sales/domain/entities/{Sale,SaleItem}.ts` (centavos; `sellerId`; snapshot de código e código de barras), `domain/enums/SaleStatus.ts` (`CANCELED`)
- Modify: `backend/src/modules/sales/interfaces/http/schemas/createSaleSchema.ts` (corpo da spec §4; remover `sellerId`, `discount`, `notes`); remover `createOrderSchema.ts`/`updateOrderSchema.ts` se sem uso
- Modify: `CreateSaleUseCase.ts`, `CreateSaleController.ts` (`sellerId` do token; `201 { data }`), `GetSaleController.ts`/`ListSalesController.ts` (envelopes), `SaleReadMapper.ts`, DTOs, `PrismaSaleReadRepository.ts`, mappers Prisma de venda
- Modify: `backend/src/modules/finance/application/services/{FinacialService,FinancialApplicationService}.ts` (`createSaleReceivable`), `CreateReceivableUseCase.ts` (`originId` correto)
- Create: `frontend/src/test/fixtures/sales/{saleDetail,saleList}.json`
- Test: `backend/src/modules/sales/domain/__tests__/InstallmentPlan.test.ts`, `backend/src/modules/sales/infrastructure/http/__tests__/salesHttp.test.ts`

**Interfaces:**
- Consumes: Task 1 (`toCents`, `salePrice`).
- Produces: `buildInstallments(totalCents: number, installments: number, firstDueDate: Date): { amountCents: number; dueDate: Date }[]`; `FinancialService.createSaleReceivable({ saleId, customerId, parcels: { amount: number; dueDate: Date }[] })`; `SaleDetailDTO`/`SaleListItemDTO` (spec §5); fixtures.

- [ ] **Step 1: Testes (falhando)**
```ts
test("1x → uma parcela = total, vencimento = data informada")
test("10000 em 3x → [3333, 3333, 3334]; 5 em 3x → [1, 1, 3]")                       // Review Focus 1
test("primeiro vencimento 31/01 → 28/02 (ou 29/02 bissexto) e 31/03")              // Review Focus 2
test("POST /sales cria venda com total = Σ preço×qtd, sellerId do token, status COMPLETED")
test("POST /sales gera contas a receber com parcelas que somam o total")
test("POST /sales variante com preço 0 → 422 VARIANT_WITHOUT_PRICE; nada gravado")
test("POST /sales 3x sem firstDueDate → 400 VALIDATION_ERROR field paymentTerms.firstDueDate")
test("POST /sales firstDueDate no passado → 400")
test("falha ao criar o financeiro desfaz venda e estoque")                         // Review Focus 3 (FinancialService fake que lança, use case real com PrismaTransactionManager)
test("movimentações OUT da venda têm originId = sale.id")
test("GET /sales/:id → { data } com chaves iguais à fixture saleDetail.json")
test("GET /sales → { data, pagination } com itens iguais à fixture saleList.json")
test("POST /receivables → 404 ROUTE_NOT_FOUND")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar** (remover a rota `POST /receivables`). - [ ] **Step 4: PASS + `npm test`.**
- [ ] **Step 5: Commit** — `feat(sales): server-priced sales with installment receivables and consistent DTOs`

---

### Task 3: Cancelamento da venda

**Files:**
- Create: `backend/src/modules/inventory/application/useCases/commands/ReturnSaleStockUseCase.ts` (+ factory), `InventoryService.returnSaleStock(saleId)`
- Modify: `backend/src/modules/inventory/domain/repositories/StockMovementRepository.ts` (+ `findByOrigin(origin, originId)`), Prisma impl, fakes
- Modify: `backend/src/modules/sales/application/useCases/commands/CancelSaleUseCase.ts`, `SaleRepository` (+ `lockById(id)`), Prisma impl; rota `POST /sales/:id/cancel` + controller + factory
- Modify: `FinancialService.cancelSaleReceivable(saleId)` (+ use case `CancelSaleReceivableUseCase` em finance; repositório de documento com `findByOrigin`, `update` de status, verificação de pagamentos)
- Test: `backend/src/modules/sales/infrastructure/http/__tests__/cancelSale.test.ts`, `backend/src/modules/inventory/application/useCases/commands/__tests__/ReturnSaleStock.test.ts`

**Interfaces:**
- Consumes: Task 2 (`originId` nas movimentações; documento por venda).
- Produces: `POST /sales/:id/cancel → 200 { data: SaleDetailDTO }`.

- [ ] **Step 1: Testes (falhando)**
```ts
test("cancelar devolve a cada lote exatamente o que saiu dele (venda que consumiu 2 lotes)") // Review Focus 4
test("cancelar gera movimentações IN origin RETURN com originId da venda e saldos encadeados")
test("cancelar marca o documento CANCELED e as parcelas aparecem CANCELED no detalhe")
test("cancelar de novo → 409 SALE_ALREADY_CANCELED")
test("dois cancelamentos simultâneos → exatamente um 409; estoque devolvido uma vez")
test("venda com pagamento registrado → 409 SALE_HAS_PAYMENTS; nada alterado")            // pagamento criado direto via prisma no teste
test("venda inexistente → 404 SALE_NOT_FOUND")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×.**
- [ ] **Step 5: Commit** — `feat(sales): cancel sale restoring stock to original lots and canceling receivable`

---

### Task 4: Frontend — preço, carrinho e condição de pagamento

**Files:**
- Modify: `frontend/src/modules/products/components/VariantForm.tsx` (+ coluna de preço em `ProductVariantColumns.tsx`), tipos de variante
- Create: `frontend/src/modules/sales/utils/installments.ts` (`buildInstallments` com a mesma regra; centavos), `frontend/src/shared/utils/money.ts` (`toCents`, `fromCents`, `formatCurrency` se não existir)
- Modify: `frontend/src/modules/sales/hooks/useSaleCart.ts`, `pages/SaleCreatePage.tsx`, `hooks/useCreateSale.ts`, `services/saleService.ts`, `types.ts`
- Delete: `pages/SalesPage.tsx`, `pages/SalesScanPage.tsx`, `components/Cart.tsx`, `components/ProductList.tsx`, `hooks/useProducts.ts` (módulo sales), bloco comentado do service, mensagens sem uso
- Test: `frontend/src/modules/sales/utils/__tests__/installments.test.ts`, `frontend/src/modules/sales/pages/__tests__/SaleCreatePage.test.tsx`, `frontend/src/modules/products/components/__tests__/VariantForm.test.tsx`

**Interfaces:**
- Consumes: contrato e fixtures da Task 2.
- Produces: `createSale(dto: { customerId; items: { productVariantId; quantity }[]; paymentTerms: { installments: number; firstDueDate?: string } }): Promise<SaleDetail>`.

- [ ] **Step 1: Testes (falhando)**
```ts
test("installments front: mesma regra do backend (10000/3, 31/01)")
test("VariantForm envia salePrice")
test("carrinho mostra preço da variante e total real")
test("variante sem preço mostra alerta e bloqueia 'Registrar venda'")               // Review Focus 5
test("parcelado 3x mostra prévia de 3 parcelas e envia paymentTerms")
test("campo de quantidade pode ser apagado e valida no envio")
test("erro do backend aparece uma única vez")
test("sucesso navega para /sales/:id da venda criada")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test`; tsc ≤ 43.**
- [ ] **Step 5: Commit** — `feat(frontend): variant price, real cart totals and payment terms`

---

### Task 5: Frontend — detalhe da venda e cancelamento

**Files:**
- Create: `frontend/src/modules/sales/pages/SaleDetailPage.tsx`, `hooks/useSale.ts`, `hooks/useCancelSale.ts`
- Modify: `frontend/src/modules/sales/routes.tsx` (`/sales/:id`), `hooks/useSaleColumns.tsx` (link correto), `pages/SaleListPage.tsx` (botão/link válido; tipos da lista), `services/saleService.ts` (`getSale`, `cancelSale`), handlers MSW de vendas usando as fixtures
- Test: `frontend/src/modules/sales/pages/__tests__/SaleDetailPage.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("detalhe mostra cliente, vendedor, itens com preço, total e parcelas")
test("cancelar pede confirmação, chama POST /sales/:id/cancel e mostra status Cancelada")
test("cancelar com 409 SALE_HAS_PAYMENTS mostra a mensagem do backend")
test("lista linka para /sales/:id")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test` PASS; `npx tsc -b` ≤ 43; `npx vite build` OK.
- [ ] **Step 5: Commit** — `feat(frontend): sale detail page with cancellation`
