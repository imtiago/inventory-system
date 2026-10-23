# Fase 6A — Compras e contas a pagar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar fornecedores, criar pedidos de compra que geram contas a pagar, receber mercadoria nos lotes do estoque e pagar/estornar contas a pagar.

**Architecture:** Módulo `purchases` (domínio existente reaproveitado/reescrito) com casos de uso transacionais; recebimento passa pelo `InventoryService` com a mesma ordem de trava das vendas; contas a pagar reutiliza `FinancialDocument` e os casos de uso da 3B generalizados por `FinancialType`; frontend com módulos `suppliers`, `purchases` e telas de financeiro generalizadas.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, `node:test`; React 19, TanStack Query 5, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase6a-purchases-payables-design.md`

## Global Constraints

- Branch `feat/phase6a-purchases`; `git add` com caminhos explícitos.
- Respostas `{ data }` / `{ data, pagination }`; `limit` ≤ 100; dinheiro em centavos; datas `YYYY-MM-DD`; "hoje" = `todayInBusinessTz()`.
- Erros pelas classes de `@shared/domain/errors`, mensagens PT, códigos exatamente como na spec. Controllers sem `catch`; entrada via `parseInput`.
- Permissões novas exatamente como na tabela da spec, no backend e no espelho do frontend; teste `routeGate` e matriz da 4A estendidos.
- Migrations aditivas: `migrate diff` → SQL à mão → `migrate deploy` → `generate`; nunca reset.
- Testes paralelos: dados `tx-test-` com ids rastreados, usuários por papel via helper; nunca alterar `tx-test-inventory@local` nem dados reais; nada de limpeza por prefixo.
- CI tem que continuar verde: backend `npm run typecheck` = 0; frontend `npm run lint` = 0 e `npm run typecheck` = 0.
- Nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Dois recebimentos simultâneos do mesmo pedido que juntos excedem o pedido → um recebe 422, estoque nunca passa do pedido — teste em Task 3.
2. Cancelamento e recebimento simultâneos → exatamente um conclui, sem estoque de pedido cancelado — teste em Task 3.
3. Item com desconto/frete que gera custo unitário com centavos quebrados (ex.: 3 un. por R$ 10,00 total) → custo arredondado, soma das parcelas = total exato — teste em Task 2.
4. Pagar um recebível pela rota de contas a pagar (ou o contrário) → 404, nunca altera o documento — teste em Task 4.
5. ESTOQUISTA recebe mercadoria mas não vê contas a pagar nem cria pedido; VENDEDOR não vê compras — teste em Task 1 (matriz) e Task 5 (menu).

---

### Task 1: Backend — permissões e fornecedores

**Files:**
- Modify: `backend/src/shared/auth/permissions.ts` (chaves novas), testes de matriz/`routeGate`
- Create: `backend/src/shared/domain/document.ts` (validação CPF/CNPJ, `documentType`) + testes; módulo `backend/src/modules/purchases/**` para fornecedores (use cases, repositórios Prisma, schemas, controllers, rotas `/suppliers`), registro em `app.ts`
- Create: `frontend/src/test/fixtures/purchases/{supplier,supplierList}.json`
- Test: `backend/src/shared/domain/__tests__/document.test.ts`, `backend/src/modules/purchases/infrastructure/http/__tests__/suppliers.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("CPF/CNPJ válidos aceitos (com e sem máscara); dígito verificador errado e sequência repetida → inválido")
test("POST /suppliers grava documento só com dígitos e documentType; duplicado → 409 SUPPLIER_DOCUMENT_ALREADY_EXISTS")
test("PATCH parcial altera só o enviado; DELETE com pedido → 409 SUPPLIER_IN_USE; sem → 204")
test("GET /suppliers?search= por nome, documento e e-mail; chaves = fixtures")
test("matriz: VENDEDOR → 403 em /suppliers; ESTOQUISTA lê mas não cria (403)")   // Review Focus 5
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(purchases): purchase permissions and supplier management`

---

### Task 2: Backend — pedidos de compra com contas a pagar e cancelamento

**Files:**
- Modify: `backend/prisma/schema.prisma` + migration (se necessário: `Purchase.code @unique`, `cancelReason`, `canceledAt`), `NumberRangeName` (`PURCHASE`)
- Create: use cases `CreatePurchase`, `ListPurchases`, `GetPurchase`, `CancelPurchase`, mappers/DTOs, rotas `/purchases`; criação do documento PAYABLE via serviço do financeiro (generalizar `CreateReceivableUseCase` ou criar `createPurchasePayable` no `FinancialService`)
- Create: `frontend/src/test/fixtures/purchases/{purchaseDetail,purchaseList}.json`
- Test: `backend/src/modules/purchases/infrastructure/http/__tests__/purchases.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("POST /purchases calcula total por item e geral em centavos e unitCost arredondado")      // Review Focus 3
test("cria contas a pagar PAYABLE/SUPPLIER/PURCHASE com parcelas que somam o total exato")
test("purchaseDate futura → 400; firstDueDate antes da data do pedido → 400; variante repetida → 400; total 0 → 422")
test("GET /purchases filtra por status, fornecedor e período; GET /:id com payable; chaves = fixtures")
test("cancelar sem recebimento → CANCELED e documento CANCELED; com pagamento → 409 PURCHASE_HAS_PAYMENTS; duas vezes → 409")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(purchases): purchase orders with payables and cancellation`

---

### Task 3: Backend — recebimento no estoque

**Files:**
- Modify: `backend/src/modules/inventory/application/services/{InventoryService,InventoryApplicationService}.ts` (`receivePurchaseStock`), `ReceiveInventoryUseCase`/DTO (aceitar `purchaseItemId`, `userId`, origem `PURCHASE`)
- Create: `ReceivePurchaseUseCase`, controller, schema, rota `POST /purchases/:id/receipts`
- Test: `backend/src/modules/purchases/infrastructure/http/__tests__/receipts.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("recebimento parcial → PARTIALLY_RECEIVED; estoque, custo médio, lote com purchaseItemId e movimentação PURCHASE com userId")
test("receber o restante → RECEIVED; receber de novo → 409 PURCHASE_ALREADY_RECEIVED")
test("quantidade acima do restante → 422 RECEIPT_EXCEEDS_REMAINING; item de outro pedido → 404")
test("dois recebimentos simultâneos que juntos excedem → um 201 e um 422; estoque = pedido")   // Review Focus 1
test("cancelamento e recebimento simultâneos → exatamente um conclui")                          // Review Focus 2
test("pedido cancelado → 409 PURCHASE_CANCELED; ESTOQUISTA pode receber")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(purchases): receive purchase items into inventory lots`

---

### Task 4: Backend — contas a pagar

**Files:**
- Modify: `backend/src/modules/finance/**` (casos de uso e repositório de leitura parametrizados por `FinancialType`; recebíveis filtram `RECEIVABLE`; DTO de payable com fornecedor e código do pedido), rotas `/payables`
- Create: `frontend/src/test/fixtures/finance/{payableList,payableDetail}.json`
- Test: `backend/src/modules/finance/infrastructure/http/__tests__/payables.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("GET /payables lista só PAYABLE com fornecedor e purchaseCode; filtros e summary")
test("pagar parcela e estornar via /payables seguem as regras da 3B")
test("pagar um recebível via /payables → 404; pagar um payable via /receivables → 404")      // Review Focus 4
test("VENDEDOR e ESTOQUISTA → 403 em /payables; chaves = fixtures")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3× (incluindo as suítes de recebíveis); typecheck 0.**
- [ ] **Step 5: Commit** — `feat(finance): payables API sharing receivables rules by document type`

---

### Task 5: Frontend — fornecedores e pedidos de compra

**Files:**
- Modify: `frontend/src/shared/auth/permissions.ts`, rotas/menu (grupo Compras)
- Create: `frontend/src/modules/suppliers/**`, `frontend/src/modules/purchases/**` (lista, novo pedido, detalhe, modais de recebimento e cancelamento), handlers MSW
- Test: `frontend/src/modules/suppliers/pages/__tests__/SupplierListPage.test.tsx`, `frontend/src/modules/purchases/pages/__tests__/{PurchaseListPage,PurchaseCreatePage,PurchaseDetailPage}.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("fornecedores: criar envia documento só com dígitos; 409 no campo documento; excluir com confirmação")
test("novo pedido: totais por item e geral, prévia de parcelas, corpo enviado")
test("detalhe: recebimento parcial envia { items: [{ purchaseItemId, quantity, batchNumber }] }; cancelar exige motivo")
test("menu: ESTOQUISTA vê Compras e não vê Contas a pagar; VENDEDOR não vê Compras; botões por permissão")   // Review Focus 5
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS; lint 0; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(frontend): suppliers and purchase orders with receiving`

---

### Task 6: Frontend — contas a pagar

**Files:**
- Modify: `frontend/src/modules/receivables/**` → generalizar páginas/componentes por tipo de documento (ou extrair para `frontend/src/modules/finance/`), mantendo os testes de recebíveis verdes
- Create: rotas `/payables`, `/payables/:id`, serviço e hooks de payables, item de menu
- Test: `frontend/src/modules/payables/pages/__tests__/{PayableListPage,PayableDetailPage}.test.tsx` (ou no módulo generalizado)

- [ ] **Step 1: Testes (falhando)**
```tsx
test("lista de contas a pagar com fornecedor, link para o pedido, filtros e resumo")
test("pagar parcela envia o corpo certo; estornar exige motivo; botões por permissão")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test`; lint 0; typecheck 0; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): payables list and detail sharing receivables components`
