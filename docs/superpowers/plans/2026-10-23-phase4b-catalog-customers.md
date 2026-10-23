# Fase 4B — Catálogo e clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar produtos, variantes, marcas, categorias e clientes corretos de ponta a ponta (CRUD funcional, exclusão segura, contratos `{ data }`), com telas completas no front.

**Architecture:** Casos de uso com entrada tipada e validação Zod via `parseInput`; DTOs de leitura estáveis com fixtures de contrato; exclusão checa vínculos e devolve 409 específico (P2003 → 409 como rede de segurança); unicidade de nome sem caixa por índice `lower(name)`; front com serviços tipados, `useCrudMutation` e `ConfirmDialog`.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, `node:test`; React 19, TanStack Query 5, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase4b-catalog-customers-design.md`

## Global Constraints

- Branch `feat/phase4b-catalog`; `git add` com caminhos explícitos.
- Respostas `{ data }` / `{ data, pagination: { page, limit, total, totalPages } }`; `limit` 1–100 (padrão 10) em todas as listas de catálogo e clientes.
- Erros pelas classes de `@shared/domain/errors`, mensagens PT, códigos novos exatamente como na spec: `BRAND_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `PRODUCT_IN_USE`, `VARIANT_IN_USE`, `LAST_VARIANT`, `RESOURCE_IN_USE`, `BRAND_ALREADY_EXISTS`, `CATEGORY_ALREADY_EXISTS`, `BRAND_IN_USE`, `CATEGORY_IN_USE`, `CUSTOMER_NOT_FOUND` (reusar se existir). Controllers sem `catch`; entrada via `parseInput`.
- Permissões como na matriz da 4A (`catalog.read/write/delete`, `customers.read/write`); o teste `routeGate` deve continuar passando.
- Migration: `migrate diff` → SQL à mão (mescla de duplicatas + índices `lower(name)`) → `migrate deploy` → `generate`; nunca reset.
- Testes paralelos: dados com prefixo `tx-test-` e ids rastreados, apagados no `after`; usuários de teste via helper de usuários por papel da 4A; nunca alterar `tx-test-inventory@local` nem dados reais.
- tsc backend ≤ 130 (reduzir onde tocar); frontend `tsc -b` ≤ 30; nenhuma dependência nova.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Excluir um produto que já foi vendido ou movimentado → 409 com mensagem clara, nunca 500, e nada apagado parcialmente — teste em Task 1.
2. Criar marca "Natura " quando existe "natura" → 409 (sem duplicar), inclusive com duas criações simultâneas — teste em Task 2.
3. Editar só o telefone de um cliente não apaga e-mail/endereço nem altera o nome — teste em Task 3.
4. Produto com mais de 10 variantes: o detalhe pagina e mostra o total real — teste em Task 4.
5. Editar produto trocando só a marca mantém nome/descrição/categoria — teste em Task 1 (backend) e Task 4 (front envia só o alterado).

---

### Task 1: Backend — produtos e variantes

**Files:**
- Modify: `backend/src/modules/catalog/**` (DTOs `ProductDetailDTO`/`VariantDTO`, `UpdateProductUseCase` + schema + controller, `GetProductByIdUseCase`, `CreateProductController` (resposta com DTO completo), `ListProductsUseCase`/read repo (search por código de barras, `brandId`, `categoryId`, `limit` ≤ 100), `DeleteProductUseCase`, `DeleteProductVariantUseCase`, repositório com consulta "em uso"), `backend/src/shared/http/errorHandler.ts` (P2003 → 409 `RESOURCE_IN_USE`), `errorCodes.ts`
- Delete: código morto do catálogo listado na spec (Limpeza) e `backend/src/modules/purchases/infrastructure/http/**`
- Create: `frontend/src/test/fixtures/catalog/{productDetail,productList,variantList}.json`
- Test: `backend/src/modules/catalog/infrastructure/http/__tests__/products.test.ts`, `.../variantsDelete.test.ts`, `backend/src/shared/http/__tests__/errorHandler.p2003.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("PUT /products/:id só com brandId troca a marca e mantém nome/descrição/categoria")   // Review Focus 5
test("PUT /products/:id com marca inexistente → 404 BRAND_NOT_FOUND; corpo vazio → 400")
test("GET /products/:id → { data } com brand e category; chaves = fixture productDetail")
test("GET /products?search= encontra por nome, código do produto e código de barras; limit=101 → 400")
test("GET /products?brandId=&categoryId= filtra")
test("DELETE /products/:id sem uso → 204 e variantes/estoque zerado somem")
test("DELETE /products/:id com movimentação ou venda → 409 PRODUCT_IN_USE e nada apagado")   // Review Focus 1
test("DELETE /variants/:id em uso → 409 VARIANT_IN_USE; última variante → 409 LAST_VARIANT")
test("P2003 genérico → 409 RESOURCE_IN_USE")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; tsc ≤ 130.**
- [ ] **Step 5: Commit** — `feat(catalog): working product update, detail DTO, search filters and safe deletes`

---

### Task 2: Backend — marcas e categorias

**Files:**
- Modify/Create: `backend/src/modules/catalog/**` (use cases List/Get/Create/Update/Delete para marca e categoria, schemas, controllers, factories, rotas), migration `<ts>_brand_category_unique_name` (mescla + índices)
- Create: `frontend/src/test/fixtures/catalog/brandList.json`
- Test: `backend/src/modules/catalog/infrastructure/http/__tests__/brandsCategories.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("POST /brands ' Natura  X ' grava 'Natura X'; GET /brands/:id → { data: { id, name, productsCount } }")
test("POST /brands com nome existente em outra caixa → 409 BRAND_ALREADY_EXISTS")
test("duas criações simultâneas do mesmo nome → uma 201 e uma 409 BRAND_ALREADY_EXISTS")   // Review Focus 2
test("PUT /brands/:id renomeia; para nome de outra marca → 409")
test("DELETE /brands/:id com produtos → 409 BRAND_IN_USE; sem produtos → 204; VENDEDOR → 403")
test("GET /brands?search=&limit= pagina e filtra sem caixa; chaves = fixture brandList")
test("mesmos cenários para /categories com códigos CATEGORY_*")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration (verificar no banco de dev que as duplicatas foram mescladas e os produtos repontados; registrar no relatório).** - [ ] **Step 4: PASS + `npm test` 3×.**
- [ ] **Step 5: Commit** — `feat(catalog): brand and category CRUD with case-insensitive unique names`

---

### Task 3: Backend — clientes

**Files:**
- Modify: `backend/src/modules/customer/**` (schemas create/update, `UpdateCustomerUseCase` parcial com 404, presenter/DTO com `code`, read repo com busca por código/e-mail/telefone, `limit` ≤ 100, rota `PATCH /customers/:id` no lugar do `PUT`), limpeza de código morto do módulo
- Create: `frontend/src/test/fixtures/customers/{customer,customerList}.json`
- Test: `backend/src/modules/customer/infrastructure/http/__tests__/customers.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("POST /customers só com name → 201 { data } com code; nome 'Ana  McDonald' preserva maiúsculas e colapsa espaços")
test("opcionais aceitam ausente, null e '' (→ null); e-mail inválido → 400; telefone com 9 dígitos → 400")
test("PATCH /customers/:id { phone } altera só o telefone")                               // Review Focus 3
test("PATCH inexistente → 404 CUSTOMER_NOT_FOUND; corpo vazio → 400; PUT → 404 ROUTE_NOT_FOUND")
test("GET /customers?search= encontra por código e por telefone; chaves = fixtures")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; tsc ≤ 130.**
- [ ] **Step 5: Commit** — `feat(customer): partial update, preserved names, wider search and data envelopes`

---

### Task 4: Frontend — produtos

**Files:**
- Modify: `frontend/src/modules/products/**` (types, `productService`, hooks, `ProductListPage` com busca/filtros/confirmação, `ProductDetailsPage` com paginação real, `ProductEditPage` reescrita, `ProductForm` reutilizado), `frontend/src/modules/brands/services`, `frontend/src/modules/categories/services` (até 100 itens), `frontend/src/modules/inventory` (`useSearchProducts` com envelope correto)
- Delete: `ScanProductPage`, `ProductTable`, `productColumns`, `StockBadge` e tipos duplicados não usados
- Test: `frontend/src/modules/products/pages/__tests__/{ProductListPage,ProductDetailsPage,ProductEditPage}.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("lista: busca envia search após debounce; filtros enviam brandId/categoryId; total pela pagination.total")
test("excluir pede confirmação; 409 PRODUCT_IN_USE mostra a mensagem uma vez")
test("detalhe mostra marca e categoria; 12 variantes → página 2 busca page=2; título mostra 12")   // Review Focus 4
test("edição pré-preenche; trocar só a marca envia { brandId }")                          // Review Focus 5
test("dropdowns pedem limit=100")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS; tsc ≤ 30.**
- [ ] **Step 5: Commit** — `feat(frontend): product list search, real variant pagination and working product edit`

---

### Task 5: Frontend — marcas, categorias e clientes

**Files:**
- Create: `frontend/src/modules/brands/{routes.tsx,pages/BrandListPage.tsx,components/BrandFormModal.tsx,hooks/*}`, idem `categories` (ou um componente genérico `NamedEntityPage` compartilhado pelos dois, se ficar mais simples), handlers MSW
- Modify: rotas/menu (grupo "Catálogo": Produtos, Marcas, Categorias), `frontend/src/modules/customers/**` (PATCH só alterados, editar pelo detalhe, remover link `/customers/:id/edit` e `deleteProduct`, tipos `null`, `<Can permission="customers.write">`, sem forçar caixa)
- Test: `frontend/src/modules/brands/pages/__tests__/BrandListPage.test.tsx`, `frontend/src/modules/categories/pages/__tests__/CategoryListPage.test.tsx`, `frontend/src/modules/customers/pages/__tests__/{CustomerListPage,CustomerDetailsPage}.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("marcas: lista com busca e contagem; criar/renomear; 409 BRAND_ALREADY_EXISTS no campo nome")
test("marcas: excluir com confirmação; 409 BRAND_IN_USE mostra a mensagem; botão oculto para VENDEDOR")
test("categorias: mesmos cenários")
test("menu Catálogo mostra Produtos, Marcas e Categorias")
test("cliente: Editar no detalhe abre o modal; alterar só o telefone envia PATCH { phone }")
test("cliente: nome exibido como gravado; botões de criar/editar ocultos sem customers.write")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test`; `tsc -b` ≤ 30; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): brand and category management, customer edit from details with partial updates`
