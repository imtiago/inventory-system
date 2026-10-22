# Fase 2 — Erros tipados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo erro da API chega ao cliente com status correto, `message` em português e `code` estável; entrada validada de forma única; frontend trata erros de forma consistente.

**Architecture:** Classes de erro de domínio em `shared/domain/errors` (sem HTTP); um `setErrorHandler` central mapeia classe → status/corpo; controllers sem `try/catch`, validando com `parseInput`. Frontend centraliza em `parseApiError` + `applyFieldErrors` + toast padrão nas mutações.

**Tech Stack:** Backend Fastify 5, Zod 4, Prisma 6, `node:test` via `tsx --test`. Frontend React 19, TanStack Query 5, react-hook-form, sonner, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-22-phase2-typed-errors-design.md`

## Global Constraints

- Branch `feat/phase2-typed-errors`. Nunca stage `backend/src/modules/catalog/infrastructure/http/controllers/DeleteProductVariantController.ts` (edição não commitada do usuário) — se uma task precisar alterá-lo, preserve a edição do usuário, commit o arquivo inteiro e registre no relatório. Sempre `git add` com caminhos explícitos.
- Escopo backend: `shared` + módulos `auth, catalog, customer, finance, inventory, sales, nfe-import`. `purchases` não é tocado.
- Corpo de erro sempre `{ message: string, code: string, errors?: { field: string, message: string }[] }`. Sucesso continua `{ data }` / `{ data, pagination }`.
- Status: ValidationError/ZodError 400 `VALIDATION_ERROR` (message `"Dados inválidos."`); UnauthorizedError 401; ForbiddenError 403 (`"Acesso negado."`, `FORBIDDEN`); NotFoundError 404; ConflictError 409; BusinessRuleError 422; Prisma P2002 409 `{ "Registro já existe.", CONFLICT }`; P2025 404 `{ "Registro não encontrado.", NOT_FOUND }`; erro Fastify 4xx `{ "Requisição inválida.", BAD_REQUEST }`; demais 500 `{ "Erro interno do servidor.", INTERNAL_ERROR }` com `request.log.error(err)`.
- Auth: token ausente `{ "Token ausente.", UNAUTHENTICATED }`; inválido `{ "Token inválido.", UNAUTHENTICATED }`; login inválido 401 `INVALID_CREDENTIALS`; sem `JWT_SECRET` o processo não inicia, mensagem `"JWT_SECRET não definido."`. `.env` carregado explicitamente (`import "dotenv/config"` em `shared/config/env.ts`; hoje só funciona porque o Prisma o carrega).
- Mensagens ao usuário em português, frase curta terminada em ponto. `code` em inglês SCREAMING_SNAKE, definidos em `shared/domain/errors/errorCodes.ts`.
- Testes de integração rodam em paralelo: limpar só ids rastreados; nunca deletar o usuário `tx-test-inventory@local`; prefixo `tx-test-`.
- Baselines: backend `tsc` 180 erros; frontend `tsc -b` 43. Não podem aumentar.
- Nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Erro de domínio lançado dentro de `TransactionalUseCase` atravessa o `PrismaTransactionManager` e chega como 4xx (não 500) — teste em Task 3.
2. Rota inexistente responde 404 no formato padrão `{ "Rota não encontrada.", ROUTE_NOT_FOUND }` — teste em Task 1.
3. `throw` de valor que não é `Error` (string/objeto) vira 500 genérico sem quebrar o handler — teste em Task 1.
4. Upload de NF-e sem arquivo ou com extensão inválida responde 400/422 no formato padrão, não 500 — teste em Task 4.
5. Resposta 401 no frontend redireciona ao login sem exibir toast de erro — teste em Task 6.

---

### Task 1: Núcleo — erros, handler, parseInput, env e auth

**Files:**
- Create: `backend/src/shared/domain/errors/{DomainError,NotFoundError,ConflictError,BusinessRuleError,ValidationError,UnauthorizedError,ForbiddenError,errorCodes,index}.ts`
- Create: `backend/src/shared/http/errorHandler.ts`, `backend/src/shared/http/parseInput.ts`, `backend/src/shared/config/env.ts`
- Modify: `backend/src/app.ts` (registrar `errorHandler` e `setNotFoundHandler`; remover `responseInterceptor` e o handler inline; rotas públicas por caminho sem query), `backend/src/shared/middleware/{auth,authorize}.ts`, `backend/src/modules/auth/infrastructure/security/JwtTokenService.ts`, `backend/src/modules/auth/infrastructure/http/factories/AuthenticateUserFactory.ts` (usar `env.JWT_SECRET`), `backend/src/server.ts` (importar env primeiro)
- Delete: `backend/src/shared/http/responseInterceptor.ts`, `backend/src/shared/errors/AppError.ts` (atualizar o único uso)
- Test: `backend/src/shared/http/__tests__/{errorHandler,parseInput}.test.ts`, `backend/src/shared/config/__tests__/env.test.ts`, `backend/src/shared/middleware/__tests__/auth.test.ts`

**Interfaces:**
- Produces:
  - `abstract class DomainError extends Error { readonly code: string }`; `new NotFoundError(message, code = "NOT_FOUND")`, `ConflictError(message, code = "CONFLICT")`, `BusinessRuleError(message, code = "BUSINESS_RULE")`, `UnauthorizedError(message, code = "UNAUTHENTICATED")`, `ForbiddenError(message = "Acesso negado.", code = "FORBIDDEN")`, `ValidationError(message, errors: FieldError[])` com `code = "VALIDATION_ERROR"`; `type FieldError = { field: string; message: string }`; tudo reexportado por `@shared/domain/errors`.
  - `ErrorCodes` (`as const`) em `errorCodes.ts`, iniciando com os códigos da spec §1; tasks seguintes acrescentam.
  - `errorHandler(error, request, reply)` (assinatura Fastify); `registerErrorHandling(app: FastifyInstance): void` (handler + not-found).
  - `parseInput<T>(schema: ZodType<T>, input: unknown): T`.
  - `env.ts`: `export const env: { JWT_SECRET: string }` e `loadEnv(source = process.env): { JWT_SECRET: string }` (lança `Error("JWT_SECRET não definido.")`).

- [ ] **Step 1: Testes (falhando)** — o handler é testado com um `Fastify()` local registrando rotas que lançam:

```ts
test("NotFoundError → 404 {message, code}")            // body deepEqual { message: "Produto não encontrado.", code: "PRODUCT_NOT_FOUND" }
test("ConflictError → 409"); test("BusinessRuleError → 422"); test("UnauthorizedError → 401"); test("ForbiddenError → 403")
test("ValidationError → 400 com errors")                // errors [{ field: "quantity", message: "..." }]
test("ZodError não capturado → 400 VALIDATION_ERROR")
test("Prisma P2002 → 409 CONFLICT 'Registro já existe.'") // new Prisma.PrismaClientKnownRequestError("x", { code: "P2002", clientVersion: "6" })
test("Prisma P2025 → 404 NOT_FOUND")
test("JSON malformado → 400 BAD_REQUEST")
test("erro desconhecido → 500 sem a mensagem original")   // throw new Error("segredo do banco") → body não contém "segredo"
test("throw de string → 500 INTERNAL_ERROR")             // Review Focus 3
test("rota inexistente → 404 ROUTE_NOT_FOUND")           // Review Focus 2
test("parseInput aceita válido e retorna dados tipados")
test("parseInput inválido lança ValidationError com field aninhado") // path ["items", 0, "quantity"] → "items.0.quantity"
test("loadEnv sem JWT_SECRET lança 'JWT_SECRET não definido.'"); test("loadEnv com JWT_SECRET vazio lança")
test("authenticate sem header → 401 {message:'Token ausente.', code:'UNAUTHENTICATED'}")
test("authenticate token inválido → 401 'Token inválido.'")
test("rota pública com query string continua pública")   // via app.inject em "/auth/login?x=1": não é 401 de token
test("authorize papel ausente → 403 FORBIDDEN")
```

- [ ] **Step 2: Ver falhar.** `cd backend && npx tsx --test "src/shared/**/__tests__/*.test.ts"`
- [ ] **Step 3: Implementar.** `authenticate`/`authorize` lançam `UnauthorizedError`/`ForbiddenError` e nunca fazem `reply.send` de erro; o handler formata a resposta.
- [ ] **Step 4: Rodar** → PASS; `npm test` → PASS (testes existentes que dependiam de mensagens/formatos antigos de auth: atualizar).
- [ ] **Step 5: Commit** — `feat(shared): domain errors, central error handler, parseInput and required JWT_SECRET`

---

### Task 2: Catalog, customer e auth

**Files:**
- Modify: controllers em `backend/src/modules/{catalog,customer,auth}/infrastructure/http/controllers/` (sem `try/catch`; `parseInput` para body/params/query; 404 manual → `NotFoundError`); `throw new Error(` em `domain/` e `application/` desses módulos → classes de domínio com mensagens PT e códigos; schemas Zod desses módulos com mensagens PT.
- Modify: `errorCodes.ts` (acrescentar códigos usados).
- Test: `backend/src/modules/{catalog,customer,auth}/infrastructure/http/__tests__/errors.test.ts` (via `app.inject`, JWT do usuário de teste — reutilizar `backend/src/test/inventoryFixtures.ts:getTestUserId` e o padrão de assinatura de `inventoryHttp.test.ts`)

**Interfaces:**
- Consumes: Task 1 (`@shared/domain/errors`, `parseInput`).

- [ ] **Step 1: Testes (falhando)**

```ts
// catalog
test("GET /products/:id inexistente → 404 PRODUCT_NOT_FOUND")
test("POST /products/:id/variants com barcode duplicado → 409 BARCODE_ALREADY_EXISTS")
test("POST /products corpo inválido → 400 VALIDATION_ERROR com errors[].field 'name'")
test("GET /products/:id com id não-uuid → 400 VALIDATION_ERROR")
// customer
test("GET /customers/:id inexistente → 404 CUSTOMER_NOT_FOUND")
// auth
test("POST /auth/login senha errada → 401 INVALID_CREDENTIALS 'Credenciais inválidas.'")
test("POST /users e-mail duplicado → 409 EMAIL_ALREADY_IN_USE")
```

- [ ] **Step 2: Ver falhar.** `npx tsx --test "src/modules/{catalog,customer,auth}/infrastructure/http/__tests__/errors.test.ts"`
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — PASS; `npm test` PASS; `grep -rn "throw new Error(" src/modules/{catalog,customer,auth}/{domain,application}` vazio; `grep -rln "catch" src/modules/{catalog,customer,auth}/infrastructure/http/controllers` vazio.
- [ ] **Step 5: Commit** — `refactor(catalog,customer,auth): typed errors and parseInput`

---

### Task 3: Inventory

**Files:**
- Modify: controllers de `backend/src/modules/inventory/infrastructure/http/controllers/` (trocar `sendBadRequest`/`formatZodError` por `parseInput` e remover `try/catch`); `throw new Error(` em `domain/` e `application/` do inventory (53) → classes de domínio; schemas com mensagens PT.
- Delete: `backend/src/shared/http/formatZodError.ts`.
- Modify: testes existentes do inventory que afirmam mensagens/status antigos (`inventoryHttp.test.ts`, testes de use cases e entidades).
- Test: `backend/src/modules/inventory/infrastructure/http/__tests__/errors.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Códigos mínimos: `VARIANT_NOT_FOUND`, `INVENTORY_NOT_FOUND`, `INVENTORY_ALREADY_EXISTS`, `LOT_NOT_FOUND`, `BOX_NOT_FOUND`, `INSUFFICIENT_STOCK`, `BOX_LIMIT_EXCEEDED`, `INVALID_QUANTITY`. Mensagem do limite da caixa permanece exata: `Quantidade excede o saldo do lote disponível para caixas (X).`

- [ ] **Step 1: Testes (falhando)**

```ts
test("POST /inventory/dispatch acima do disponível → 422 INSUFFICIENT_STOCK")  // Review Focus 1 (use case transacional)
test("POST /inventory/boxes/:id/items acima do limite → 422 BOX_LIMIT_EXCEEDED com a mensagem exata")
test("GET /inventory/:id inexistente → 404 INVENTORY_NOT_FOUND")
test("POST /inventory/ variante já com inventário → 409 INVENTORY_ALREADY_EXISTS")
test("POST /inventory/lots quantity 0 → 400 VALIDATION_ERROR field 'quantity'")
test("GET /inventory/variants/:id sem inventário → 404 (VariantStock depende disso)")
```

- [ ] **Step 2: Ver falhar.** `npx tsx --test src/modules/inventory/infrastructure/http/__tests__/errors.test.ts`
- [ ] **Step 3: Implementar e atualizar testes antigos.**
- [ ] **Step 4: Verificar** — PASS; `npm test` PASS; greps de `throw new Error(` e `catch` (mesmos da Task 2) vazios para inventory; `grep -rn "formatZodError\|sendBadRequest" src` vazio.
- [ ] **Step 5: Commit** — `refactor(inventory): typed errors and parseInput`

---

### Task 4: Sales, finance e nfe-import

**Files:**
- Modify: controllers e `throw new Error(` (domain/application) de `backend/src/modules/{sales,finance,nfe-import}`; schemas PT.
- Test: `backend/src/modules/{sales,finance,nfe-import}/infrastructure/http/__tests__/errors.test.ts`

**Interfaces:**
- Consumes: Task 1. Códigos: `CUSTOMER_NOT_FOUND`, `VARIANT_NOT_FOUND`, `SALE_NOT_FOUND`, `SALE_ALREADY_CANCELED`, `UNSUPPORTED_FILE_FORMAT`, `FILE_REQUIRED`.

- [ ] **Step 1: Testes (falhando)**

```ts
test("POST /sales cliente inexistente → 404 CUSTOMER_NOT_FOUND")
test("POST /sales corpo inválido → 400 VALIDATION_ERROR")
test("GET /sales/:id inexistente → 404 SALE_NOT_FOUND")
test("finance: POST de recebível/pagável com corpo inválido → 400 VALIDATION_ERROR")
test("nfe-import sem arquivo → 400 FILE_REQUIRED")             // Review Focus 4
test("nfe-import extensão .txt → 422 UNSUPPORTED_FILE_FORMAT") // Review Focus 4
```
(Rotas exatas: conferir `routes/` de cada módulo e o `app.ts`; testes de finance usam a rota registrada que aceita corpo.)

- [ ] **Step 2: Ver falhar.** `npx tsx --test "src/modules/{sales,finance,nfe-import}/infrastructure/http/__tests__/errors.test.ts"`
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — PASS; `npm test` PASS; greps vazios para os três módulos.
- [ ] **Step 5: Commit** — `refactor(sales,finance,nfe-import): typed errors and parseInput`

---

### Task 5: Contrato de erro e aceite do backend

**Files:**
- Create: `frontend/src/test/fixtures/errors/{validation,notFound,conflict,businessRule,internal}.json`
- Test: `backend/src/shared/http/__tests__/errorContract.test.ts` — provoca respostas reais (400 via corpo inválido, 404 via id inexistente, 409 via barcode duplicado, 422 via estoque insuficiente; 500 via rota de teste registrada só no teste num `Fastify()` com `registerErrorHandling`) e compara conjuntos de chaves com as fixtures (mesmo `keyShape` de `inventoryHttp.test.ts`).

- [ ] **Step 1:** escrever fixtures e teste → rodar (deve passar se Tasks 1–4 corretas; se falhar, corrigir a origem).
- [ ] **Step 2: Aceite global** — `grep -rn "throw new Error(" src/modules/{auth,catalog,customer,finance,inventory,sales,nfe-import}/{domain,application}` vazio; `grep -rln "catch" src/modules/{auth,catalog,customer,finance,inventory,sales,nfe-import}/infrastructure/http/controllers` vazio; `npx tsc --noEmit -p .` ≤ 180; `npm test` PASS em 2 execuções seguidas.
- [ ] **Step 3: Commit** — `test: error contract fixtures shared with frontend`

---

### Task 6: Frontend — parseApiError, toast padrão e erros por campo

**Files:**
- Create: `frontend/src/shared/services/parseApiError.ts`, `frontend/src/shared/utils/applyFieldErrors.ts`
- Modify: `frontend/src/modules/inventory/utils/apiErrorMessage.ts` (delegar), `frontend/src/shared/react-query/useCrudMutation.ts` (toast padrão), `frontend/src/test/handlers/*` (erros vindos das fixtures), formulários `modules/products/components/{ProductForm,VariantForm}.tsx`, `modules/customers/components/CustomerForm.tsx`, `modules/inventory/components/InventoryLotForm.tsx`, `modules/sales/pages/SaleCreatePage.tsx`
- Test: `frontend/src/shared/services/__tests__/parseApiError.test.ts`, `frontend/src/shared/react-query/__tests__/useCrudMutation.test.tsx`, `frontend/src/modules/customers/components/__tests__/CustomerForm.test.tsx`

**Interfaces:**
- Consumes: fixtures (Task 5).
- Produces: `type ApiError = { status: number | null; code: string; message: string; fieldErrors: Record<string, string> }`; `parseApiError(error: unknown): Promise<ApiError>`; `parseApiErrorSync(error: unknown): ApiError`; `applyFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, fieldErrors: Record<string, string>): boolean`. Mensagens: rede `"Não foi possível conectar ao servidor."` / `NETWORK_ERROR`; desconhecido `"Erro inesperado."` / `UNKNOWN_ERROR`.

- [ ] **Step 1: Testes (falhando)**

```ts
test("parseApiError lê {message, code, errors}")          // fixture validation → fieldErrors { quantity: "..." }
test("parseApiError lê corpo Blob JSON")
test("parseApiError sem resposta → NETWORK_ERROR")
test("parseApiError valor estranho → UNKNOWN_ERROR")
test("useCrudMutation mostra toast com a mensagem do backend") // espiar toast.error (vi.mock('sonner'))
test("useCrudMutation não mostra toast em 401")           // Review Focus 5
test("CustomerForm mostra erro do backend no campo email") // MSW 400 com errors [{field:"email", message:"E-mail inválido."}]
```

- [ ] **Step 2: Ver falhar.** `cd frontend && npx vitest run src/shared src/modules/customers`
- [ ] **Step 3: Implementar.** `applyFieldErrors` usado nos 5 formulários listados (onde o submit chama a API).
- [ ] **Step 4: PASS;** `npm test` PASS.
- [ ] **Step 5: Commit** — `feat(frontend): unified API error parsing, default toast and field errors`

---

### Task 7: Frontend — VariantStock, assistente e aceite

**Files:**
- Modify: `frontend/src/modules/products/components/VariantStock.tsx`, `frontend/src/modules/inventory/hooks/useVariantInventory.ts` (expor `error`), `frontend/src/modules/inventory/hooks/useProductByBarcode.ts` e `useInitialInventoryFlow.ts` (decidir por `status`/`code`), testes existentes do frontend que dependem de mensagens antigas.
- Test: `frontend/src/modules/products/components/__tests__/VariantStock.test.tsx`, `frontend/src/modules/inventory/pages/__tests__/InitialInventoryPage.test.tsx`

- [ ] **Step 1: Testes (falhando)**

```tsx
test("VariantStock com erro 500 mostra 'Erro ao carregar estoque'")
test("VariantStock 404 continua 'Sem estoque'")
test("assistente: 404 VARIANT_NOT_FOUND leva a 'produto não encontrado'")
test("assistente: 500 mostra a mensagem do backend (fixture internal)")
```

- [ ] **Step 2: Ver falhar.** `cd frontend && npx vitest run src/modules/products src/modules/inventory/pages`
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test` PASS; `npx tsc -b --pretty false` ≤ 43; `npx vite build` OK.
- [ ] **Step 5: Commit** — `fix(frontend): variant stock error state and code-based wizard decisions`
