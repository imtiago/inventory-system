# Fase 3B — Financeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar e estornar pagamentos de contas a receber com status corretos e telas para acompanhamento.

**Architecture:** Entidades de finance em centavos com status derivado pela data de negócio; pagamento/estorno travam o documento (`FOR UPDATE`) e persistem o status; leitura com filtros, resumo e DTOs estáveis; frontend com lista, detalhe e modais.

**Tech Stack:** Fastify 5, Prisma 6 (PostgreSQL), Zod 4, `node:test`; React 19, TanStack Query 5, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase3b-finance-design.md`

## Global Constraints

- Branch `feat/phase3b-finance`; `git add` com caminhos explícitos.
- Acesso a banco via `getDb()`; SQL bruto só em repositórios, parametrizado.
- Erros com classes de `@shared/domain/errors`, mensagens PT; códigos novos: `FINANCIAL_DOCUMENT_NOT_FOUND`, `PARCEL_NOT_FOUND`, `PAYMENT_NOT_FOUND`, `FINANCIAL_DOCUMENT_CANCELED`, `PAYMENT_EXCEEDS_REMAINING`, `PAYMENT_ALREADY_REVERSED`. Controllers sem `catch`; entrada via `parseInput`.
- Sucesso `{ data }` / `{ data, pagination }` (lista de recebíveis também com `summary`).
- Dinheiro em centavos; "hoje" = `todayInBusinessTz()`; datas de vencimento/pagamento `YYYY-MM-DD`.
- Migration aditiva: `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` → SQL à mão → `migrate deploy` → `generate`; nunca reset (drift/reset → BLOCKED).
- Testes paralelos: ids rastreados; nunca deletar `tx-test-inventory@local`; prefixo `tx-test-`; cleanups independentes, `$disconnect` em `finally`.
- tsc backend ≤ 145; frontend `tsc -b` ≤ 30; nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Parcela que vence hoje (fuso de Brasília) aparece "Em aberto", não "Vencida" — teste em Task 1.
2. Pagamento e cancelamento da mesma venda simultâneos → exatamente um conclui — teste em Task 2.
3. Dois pagamentos simultâneos que juntos excedem a parcela → um recusado com 422 — teste em Task 2.
4. Estorno de pagamento de documento PAID volta o documento a PARTIALLY_PAID/OPEN — teste em Task 2.
5. Valor com centavos (ex.: 33,33 em parcela de 33,34) deixa restante 0,01, sem erro de float — teste em Task 2.

---

### Task 1: Domínio, migration e leitura

**Files:**
- Modify: `backend/prisma/schema.prisma` (`Payment` campos de auditoria/estorno; relações em `User`) + migration `<timestamp>_payment_audit_reversal`
- Modify: `backend/src/modules/finance/domain/entities/{Payment,FinancialParcel,FinancialDocument}.ts` (centavos, estorno, status com `today`, `recalculateStatus`), mappers Prisma de finance
- Rewrite: `backend/src/modules/finance/application/mappers/FinancialDocumentReadMapper.ts`, `PrismaFinancialDocumentReadRepository.ts` (filtros, ordenação, summary, customer name via join), `ListReceivablesUseCase`, novo `GetReceivableByIdUseCase`, controllers/rotas `GET /receivables`, `GET /receivables/:id`
- Modify: `backend/src/modules/sales/application/mappers/SaleReadMapper.ts` (status de parcela com a mesma regra/`today`)
- Create: `frontend/src/test/fixtures/finance/{receivableList,receivableDetail}.json`
- Test: `backend/src/modules/finance/domain/__tests__/status.test.ts`, `backend/src/modules/finance/infrastructure/http/__tests__/receivablesRead.test.ts`

**Interfaces:**
- Produces: `FinancialParcel.status(today: string)`, `FinancialDocument.recalculateStatus()`, `Payment.reverse(userId, reason)`; DTOs da spec §4; fixtures.

- [ ] **Step 1: Testes (falhando)**
```ts
test("parcela com vencimento hoje (negócio) → OPEN; ontem → OVERDUE")          // Review Focus 1
test("pagamento estornado não conta em paid; parcela volta a OPEN")
test("documento CANCELED → parcelas CANCELED")
test("recalculateStatus: todas pagas → PAID; parcial → PARTIALLY_PAID; nenhum → OPEN; CANCELED mantém")
test("GET /receivables filtra por status (incl. OVERDUE), customerId, dueFrom/dueTo")
test("GET /receivables ordena por próximo vencimento em aberto; pagos/cancelados por último")
test("GET /receivables summary { openAmount, overdueAmount, receivedAmount } sobre o filtro")
test("GET /receivables/:id → chaves iguais à fixture; inexistente → 404 FINANCIAL_DOCUMENT_NOT_FOUND")
test("GET /sales/:id parcela que vence hoje → OPEN")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration.** - [ ] **Step 4: PASS + `npm test`.**
- [ ] **Step 5: Commit** — `feat(finance): payment audit fields, cents-based statuses and receivables read API`

---

### Task 2: Registrar e estornar pagamento

**Files:**
- Create: `backend/src/modules/finance/application/useCases/commands/{RegisterPaymentUseCase,ReversePaymentUseCase}.ts`, repositório de pagamento (Prisma + interface), controllers, factories, schemas; rotas na `receivableRoutes`
- Modify: repositório de documento (lock por id; update de status), `errorCodes.ts`
- Test: `backend/src/modules/finance/application/useCases/__tests__/payments.test.ts`, `backend/src/modules/finance/infrastructure/http/__tests__/paymentsHttp.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: rotas da spec §4 (POST payments, POST reverse).

- [ ] **Step 1: Testes (falhando)**
```ts
test("pagamento parcial → parcela PARTIALLY_PAID, documento PARTIALLY_PAID")
test("pagar todas as parcelas → documento PAID")
test("33,33 numa parcela de 33,34 → restante 0,01")                                   // Review Focus 5
test("valor acima do restante → 422 PAYMENT_EXCEEDS_REMAINING")
test("documento CANCELED → 409 FINANCIAL_DOCUMENT_CANCELED")
test("parcela de outro documento → 404 PARCEL_NOT_FOUND")
test("paymentDate futura → 400; padrão = hoje negócio; createdById do token")
test("estorno → status recalculado; documento PAID volta a PARTIALLY_PAID")          // Review Focus 4
test("estorno duplo → 409 PAYMENT_ALREADY_REVERSED; motivo ausente → 400")
test("pagamento × cancelamento da venda simultâneos → exatamente um conclui")        // Review Focus 2
test("dois pagamentos simultâneos que juntos excedem → um 422")                       // Review Focus 3
test("cancelar venda após pagamento estornado → permitido")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; tsc ≤ 145.**
- [ ] **Step 5: Commit** — `feat(finance): register and reverse payments with document locking`

---

### Task 3: Frontend — lista de contas a receber

**Files:**
- Create: `frontend/src/modules/receivables/{routes.tsx,types.ts,services/receivableService.ts,hooks/useReceivables.ts,pages/ReceivableListPage.tsx}`, handlers MSW
- Modify: `frontend/src/routes/AppRoutes.tsx`, `frontend/src/components/Sidebar.tsx` (grupo Financeiro), `frontend/src/shared/react-query/keys.ts`
- Test: `frontend/src/modules/receivables/pages/__tests__/ReceivableListPage.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("lista mostra cliente, origem (link para a venda), totais, próximo vencimento e status PT")
test("filtros enviam status/customerId/dueFrom/dueTo na query")
test("cards de resumo mostram Em aberto, Vencido, Recebido")
test("menu tem Financeiro → Contas a receber")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS; tsc ≤ 30.**
- [ ] **Step 5: Commit** — `feat(frontend): receivables list with filters and summary`

---

### Task 4: Frontend — detalhe, pagamento e estorno

**Files:**
- Create: `frontend/src/modules/receivables/pages/ReceivableDetailPage.tsx`, `components/{RegisterPaymentModal,ReversePaymentModal}.tsx`, `hooks/{useReceivable,useRegisterPayment,useReversePayment}.ts`
- Modify: `frontend/src/modules/sales/pages/SaleDetailPage.tsx` (link "Ver contas a receber"), rotas
- Test: `frontend/src/modules/receivables/pages/__tests__/ReceivableDetailPage.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("detalhe mostra parcelas, pagamentos e estornados riscados com motivo")
test("registrar pagamento envia { amount, method, paymentDate, reference } e atualiza a tela")
test("valor acima do restante é bloqueado na tela; erro 422 do backend aparece uma vez")
test("botão de pagamento desabilitado em parcela paga e em documento cancelado")
test("estornar exige motivo e envia POST /receivables/payments/:id/reverse")
test("detalhe da venda linka para o contas a receber e vice-versa")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test`; `tsc -b` ≤ 30; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): receivable detail with payment registration and reversal`
