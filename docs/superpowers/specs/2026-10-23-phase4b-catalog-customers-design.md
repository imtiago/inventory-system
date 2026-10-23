# Fase 4B — Catálogo e clientes

**Data:** 2026-10-23
**Status:** decidido (usuário delegou: "faça da forma que achar melhor seguindo as melhores práticas"; escopo 4A/4B aprovado)
**Depende de:** Fase 2 (erros tipados), Fase 4A (permissões)

## Problema (auditoria)

- `PUT /products/:id` sempre 500 (controller chama `execute(id, data)`; input só tem `id`; repositório recebe entidade).
- `GET /products/:id` devolve objeto cru sem `brand`/`category` → `ProductDetailsPage` quebra (`product.brand.name`).
- `DELETE /products/:id` sempre 500 (todo produto tem variante padrão; FK Restrict; P2003 não mapeado). `DELETE /variants/:id` 500 quando referenciada.
- Marcas e categorias: só criar/listar; nome sem unicidade nem trim (banco atual tem duplicatas: marcas "boticario" ×2, "natura" ×2; categorias "perfumes" ×2, "maquiagens" ×2); front sem telas e dropdowns só com os 10 primeiros.
- Clientes: criação/edição exigem todos os campos e gravam o nome em minúsculas; respostas cruas sem `code`; update inexistente → 404 genérico; busca só por nome; front com link para `/customers/:id/edit` inexistente e `deleteProduct` morto chamando rota inexistente.
- Envelopes inconsistentes (cru em GET/PUT produto, POST marca/categoria, todo cliente); `limit` sem máximo em produtos/clientes.
- Front produtos: `totalItems` vs `total` (variantes "0"), paginação de variantes não envia `page`, `ProductEditPage` quebrada, `ScanProductPage`/`ProductTable`/`productColumns` mortos, sem busca, excluir produto sem confirmação.
- Código morto/duplicado: `backend/src/modules/purchases/infrastructure/http/**` (cópia não registrada do catálogo), use cases e métodos de repositório não implementados (erros de tsc).

## Fora de escopo
NF-e import (UUIDs fixos, repositório em memória) e compras — fase de compras. Documento (CPF/CNPJ) de cliente. Exclusão de cliente.

## Backend

### Contrato geral
Todas as rotas de catálogo e clientes: `{ data }` / `{ data, pagination: { page, limit, total, totalPages } }`; `limit` 1–100 (padrão 10) em todas as listas; camelCase.

### Produtos e variantes
DTOs:
```
ProductDetailDTO   { id, code, name, description: string|null, brand: {id,name}, category: {id,name}, variantsCount, createdAt }
ProductListItemDTO = ProductDetailDTO
VariantDTO         { id, productId, code, name, barcode: string|null, salePrice: number, createdAt }
```
| Rota | Permissão | Comportamento |
|---|---|---|
| `GET /products` | catalog.read | `page`, `limit`, `search` (nome, código do produto ou código de barras de alguma variante; sem diferença de caixa), `brandId?`, `categoryId?` |
| `GET /products/:id` | catalog.read | `{ data: ProductDetailDTO }`; 404 `PRODUCT_NOT_FOUND` |
| `POST /products` | catalog.write | `{ name (trim, 3–120), description? (trim, ≤500, vazio→null), brandId, categoryId }` → 201 `{ data: ProductDetailDTO }`; marca/categoria inexistente → 404 `BRAND_NOT_FOUND`/`CATEGORY_NOT_FOUND`; cria variante padrão (como hoje) |
| `PUT /products/:id` | catalog.write | edição parcial `{ name?, description?, brandId?, categoryId? }` (≥1 campo) → 200 `{ data: ProductDetailDTO }`; 404s acima |
| `DELETE /products/:id` | catalog.delete | se alguma variante estiver em uso → 409 `PRODUCT_IN_USE` ("Produto possui movimentações, vendas ou compras e não pode ser excluído."); senão apaga variantes, registros de estoque zerados e o produto numa transação → 204 |
| `GET /products/:productId/variants` | catalog.read | `{ data: VariantDTO[], pagination }` |
| `POST/PUT /variants…` | catalog.write | como hoje (envelopes já ok) |
| `DELETE /variants/:id` | catalog.delete | em uso → 409 `VARIANT_IN_USE`; última variante do produto → 409 `LAST_VARIANT` ("O produto precisa ter ao menos uma variante."); senão apaga (e o registro de estoque zerado) → 204 |

"Em uso" = existe `StockMovement`, `InventoryLot`, `SaleItem` ou `PurchaseItem` da variante, ou `Inventory` com quantidade ≠ 0/reservada ≠ 0.
Rede de segurança: `errorHandler` mapeia P2003 → 409 `RESOURCE_IN_USE` ("Registro em uso por outros dados.").

### Marcas e categorias (mesmo formato para as duas)
`DTO { id, name, productsCount }`
| Rota | Permissão | Comportamento |
|---|---|---|
| `GET /brands` | catalog.read | `page`, `limit`, `search` (nome, sem caixa); ordenado por nome |
| `GET /brands/:id` | catalog.read | 404 `BRAND_NOT_FOUND` |
| `POST /brands` | catalog.write | `{ name }` (trim, espaços internos colapsados, 1–80) → 201; duplicado sem diferença de caixa → 409 `BRAND_ALREADY_EXISTS` ("Já existe uma marca com esse nome.") |
| `PUT /brands/:id` | catalog.write | `{ name }` → 200; mesmas regras |
| `DELETE /brands/:id` | catalog.delete | com produtos → 409 `BRAND_IN_USE`; senão 204 |
Categorias: `/categories`, `CATEGORY_NOT_FOUND`, `CATEGORY_ALREADY_EXISTS` ("Já existe uma categoria com esse nome."), `CATEGORY_IN_USE`.

**Migration** `<ts>_brand_category_unique_name`: normaliza nomes (`trim` + colapsar espaços); **mescla duplicatas** sem diferença de caixa (mantém a de menor `createdAt`, ou menor `id` se não houver coluna; repõe `Product.brandId/categoryId` para a mantida; apaga as demais); cria índice único `lower(name)` em cada tabela. Corrida na criação → P2002 no índice → mesmo 409 específico.

### Clientes
`CustomerDTO { id, code, name, email: string|null, phone: string|null, address: string|null, createdAt }`
| Rota | Permissão | Comportamento |
|---|---|---|
| `GET /customers` | customers.read | `page`, `limit`, `search` (nome, código, e-mail ou telefone — dígitos) |
| `GET /customers/:id` | customers.read | 404 `CUSTOMER_NOT_FOUND` |
| `POST /customers` | customers.write | `{ name (trim, colapsa espaços, 2–120, **mantém maiúsculas**), email?, phone?, address? }` — opcionais aceitam ausente, `null` ou `""` (→ null); e-mail válido e em minúsculas; telefone só dígitos, 10–11; endereço trim ≤200 → 201 `{ data }` |
| `PATCH /customers/:id` | customers.write | edição parcial (≥1 campo), mesmas regras; 404 `CUSTOMER_NOT_FOUND` → 200 `{ data }` |
`PUT /customers/:id` é removido (único consumidor é o front, ajustado nesta fase). Nomes já gravados em minúsculas permanecem (1 cliente no banco); o usuário pode corrigir pela edição.

### Limpeza
Remover `backend/src/modules/purchases/infrastructure/http/**` (cópia do catálogo não registrada — manter domínio/aplicação de compras para a fase de compras), use cases/presenters/métodos de repositório não usados de catálogo e cliente (`GetBrandByIdUseCase` vira usado ou é reescrito; `ProductHttpPresenter`; métodos não implementados de `ProductRepository`; `CustomerService`/`CustomerApplicationService` quebrados se não usados), e corrigir os erros de tsc desses módulos.

## Frontend

- Tipos espelham os DTOs (null onde o backend manda null); fixtures de contrato em `frontend/src/test/fixtures/catalog/{productDetail,productList,variantList,brandList}.json` e `frontend/src/test/fixtures/customers/{customer,customerList}.json`, verificadas no backend com `keyShape`.
- **Produtos:**
  - lista com busca (debounce 300 ms) e filtros marca/categoria, paginação por `total`, exclusão com `ConfirmDialog` e mensagem do 409;
  - detalhe com marca/categoria, variantes paginadas de verdade (`page` na query e na chave), contagem por `pagination.total`;
  - `ProductEditPage` reescrita com `ProductForm` (pré-preenchido, envia só os campos alterados);
  - dropdowns de marca/categoria carregam até 100 itens;
  - remover `ScanProductPage`, `ProductTable`, `productColumns`, `StockBadge` e tipos duplicados se não usados;
  - `useSearchProducts` do estoque com o envelope correto.
- **Marcas e Categorias:** páginas `/brands` e `/categories` (grupo de menu "Catálogo" com Produtos), lista com busca e contagem de produtos, criar/editar em modal (409 no campo nome), excluir (`catalog.delete`) com confirmação e mensagem do 409 `*_IN_USE`.
- **Clientes:** `PATCH` na edição (envia só o alterado); remover link `/customers/:id/edit` — botão "Editar" no detalhe abre o mesmo modal da lista; remover `deleteProduct` morto; sem `toLowerCase`/`formatName` forçado (exibe o nome como gravado); botões de criar/editar com `<Can permission="customers.write">`; tipos com `null`; busca envia `limit`.
- Mensagens de erro exibidas uma vez (padrão `useCrudMutation` + `silentError` quando a tela trata).

## Testes e aceite
Backend: update parcial de produto (e 404 de marca/categoria), detalhe com marca/categoria, busca por nome/código/código de barras, delete de produto sem uso (some com variantes) e em uso (409), delete de variante em uso/última (409), P2003 → 409 genérico; CRUD de marcas/categorias com duplicata sem caixa (409), nome com espaços normalizado, delete em uso (409); migration de mescla (teste da função SQL não é necessário — verificar no banco de dev após aplicar e registrar no relatório); clientes: criar só com nome, nome preserva maiúsculas, opcionais `""`/null/ausente, PATCH parcial, 404 específico, busca por código/telefone; envelopes por fixtures; `limit > 100` → 400.
Frontend: lista de produtos (busca, filtros, excluir com confirmação e 409), detalhe (marca/categoria, paginação de variantes, total), edição de produto (pré-preenchido, envia só alterados), telas de marcas e categorias (CRUD, 409, permissões), clientes (editar pelo detalhe, PATCH só alterados, nome preservado, botões por permissão).
Aceite: backend `npm test` 3×, tsc ≤ 130 (meta: reduzir); frontend `npm test`, `tsc -b` ≤ 30, `vite build`.
