# Fase 2 — Erros tipados e validação de entrada

**Data:** 2026-10-22
**Status:** desenho aprovado em conversa; aguardando revisão da spec
**Depende de:** TransactionManager e Estoque Fase 1 (implementados)

## Problema

- O `app.ts` tem `setErrorHandler` para `ZodError`/`AppError`, mas quase todo
  controller faz `try/catch` e responde **400 para qualquer erro** — "não
  encontrado", conflito, falha de banco e bug viram 400.
- `AppError` (`shared/errors/AppError.ts`) praticamente não é usado.
- O handler global devolve `error.message` nos 500, vazando detalhes internos
  (Prisma, banco).
- `responseInterceptor` nunca roda (registrado sem `fastify-plugin`).
- Mensagens misturam inglês e português e são exibidas ao usuário.
- Validação inconsistente: só o estoque formata erros Zod; vários controllers
  não validam `params`/`query`.
- `auth.ts` usa `"secret"` como chave quando `JWT_SECRET` falta; rotas públicas
  comparadas por `request.url` exato (query string quebra a comparação).
- Frontend: extração de mensagem só existe dentro do módulo de estoque;
  `VariantStock` mostra "Sem estoque" para qualquer falha.

Contagem no escopo (`throw new Error(` em domain+application / controllers):
auth 3/4, catalog 14/14, customer 0/4, finance 1/5, inventory 53/22,
sales 11/3, nfe-import 6/1.

## Objetivos

1. Cada erro chega ao cliente com status correto (400/401/404/409/422/500),
   `message` em português e `code` estável em inglês.
2. Erros internos nunca vazam detalhes ao cliente; são registrados no log.
3. Toda rota do escopo valida `body`, `params` e `query` do mesmo jeito.
4. Frontend trata erros de forma única: mensagem, `code` e erros por campo.

## Escopo

Módulos registrados em `backend/src/app.ts`: auth, catalog, customer, finance,
inventory, sales, nfe-import; `shared`. Frontend: `shared`, módulos
products, customers, sales, inventory (consumidores dessas APIs).

## Fora de escopo

- Módulo `purchases` (não registrado em `app.ts`).
- Concorrência de estoque — fase própria, logo após esta.
- Correções funcionais de vendas/financeiro além do tratamento de erro
  (Fase 3).
- Erros de `tsc` não relacionados (apenas não podem aumentar).

## 1. Erros de domínio

Pasta `backend/src/shared/domain/errors/` (sem dependência de HTTP):

| Classe | Status (mapeado no HTTP) | `code` padrão |
|---|---|---|
| `DomainError` (abstrata; `message`, `code`, `details?`) | — | — |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `BusinessRuleError` | 422 | `BUSINESS_RULE` |
| `ValidationError` (`errors: { field, message }[]`) | 400 | `VALIDATION_ERROR` |
| `UnauthorizedError` | 401 | `UNAUTHENTICATED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |

- Construtor: `(message: string, code?: string)`; `ValidationError(message, errors)`.
- `errorCodes.ts`: catálogo `as const` de códigos específicos usados no
  projeto (ex.: `VARIANT_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `INVENTORY_NOT_FOUND`,
  `LOT_NOT_FOUND`, `BOX_NOT_FOUND`, `BARCODE_ALREADY_EXISTS`,
  `EMAIL_ALREADY_IN_USE`, `INVENTORY_ALREADY_EXISTS`, `INSUFFICIENT_STOCK`,
  `BOX_LIMIT_EXCEEDED`, `INVALID_QUANTITY`, `SALE_ALREADY_CANCELED`,
  `INVALID_CREDENTIALS`, `UNSUPPORTED_FILE_FORMAT`). Lista final definida no
  plano conforme os `throw` reais encontrados.
- `shared/errors/AppError.ts` é removido; usos migram para as classes acima.

Regras de classificação:
- Recurso inexistente → `NotFoundError`.
- Duplicidade ou estado incompatível (já existe, já cancelado) → `ConflictError`.
- Invariante/regra de negócio (quantidade ≤ 0, estoque insuficiente, limite de
  caixa, custo negativo) → `BusinessRuleError`.
- Credenciais inválidas no login → `UnauthorizedError` com
  `INVALID_CREDENTIALS` (401). Token ausente/inválido → `UnauthorizedError`
  com `UNAUTHENTICATED`. Papel sem permissão → `ForbiddenError` (403).

Todas as mensagens em português, frase curta terminada em ponto
(ex.: `"Estoque insuficiente."`, `"Variante não encontrada."`).

## 2. Validação de entrada

- `backend/src/shared/http/parseInput.ts`:
  `parseInput<T>(schema: ZodType<T>, input: unknown): T` — em falha lança
  `ValidationError("Dados inválidos.", errors)` com
  `field = issue.path.join(".")` e a mensagem da issue.
- Todo controller do escopo valida `request.body`, `request.params` e
  `request.query` (quando usados) via `parseInput`.
- `shared/http/formatZodError.ts` (Fase 1) é removido; o estoque migra para
  `parseInput`.
- Mensagens dos schemas Zod em português.

## 3. Tratador central

`backend/src/shared/http/errorHandler.ts`, registrado com
`app.setErrorHandler`. Corpo de erro sempre:
`{ message: string, code: string, errors?: { field, message }[] }`.

| Erro | Status | Corpo |
|---|---|---|
| `ValidationError` | 400 | `{ message, code, errors }` |
| `ZodError` não capturado | 400 | idem, `code: VALIDATION_ERROR` |
| `UnauthorizedError` | 401 | `{ message, code }` |
| `NotFoundError` | 404 | `{ message, code }` |
| `ConflictError` | 409 | `{ message, code }` |
| `BusinessRuleError` | 422 | `{ message, code }` |
| Prisma `P2002` | 409 | `{ message: "Registro já existe.", code: "CONFLICT" }` |
| Prisma `P2025` | 404 | `{ message: "Registro não encontrado.", code: "NOT_FOUND" }` |
| Erro do Fastify com `statusCode` 4xx (ex.: JSON malformado) | o próprio | `{ message: "Requisição inválida.", code: "BAD_REQUEST" }` |
| Qualquer outro | 500 | `{ message: "Erro interno do servidor.", code: "INTERNAL_ERROR" }` + `request.log.error(err)` |

- `responseInterceptor` removido; sucesso continua `{ data }` /
  `{ data, pagination }`.
- Controllers do escopo não têm `try/catch` que responde erro; erros sobem ao
  handler. 404 manuais (`reply.status(404)`) viram `throw new NotFoundError`.

## 4. Autenticação

- `backend/src/shared/config/env.ts`: lê e valida `JWT_SECRET` (obrigatório,
  não vazio) na inicialização; ausência → processo encerra com mensagem
  `"JWT_SECRET não definido."`. `auth.ts` e o serviço de token usam esse
  valor; nenhum fallback.
- `authenticate` lança/responde 401 no formato padrão:
  token ausente → `{ message: "Token ausente.", code: "UNAUTHENTICATED" }`;
  inválido/expirado → `{ message: "Token inválido.", code: "UNAUTHENTICATED" }`.
- `authorize` (papéis) → 403 `{ message: "Acesso negado.", code: "FORBIDDEN" }`
  (classe `ForbiddenError`).
- Rotas públicas comparadas pelo caminho sem query string
  (`request.routeOptions.url` ou `url.split("?")[0]`).

## 5. Frontend

- `frontend/src/shared/services/parseApiError.ts`:
  `parseApiError(error: unknown): Promise<ApiError>` com
  `ApiError = { status: number | null; code: string; message: string; fieldErrors: Record<string, string> }`.
  - resposta com corpo padrão → usa `message`, `code`, `errors`;
  - corpo `Blob` (respostas `responseType: 'blob'`) → lê e faz parse do JSON;
  - sem resposta (rede) → `{ status: null, code: "NETWORK_ERROR", message: "Não foi possível conectar ao servidor." }`;
  - qualquer outro → `{ code: "UNKNOWN_ERROR", message: "Erro inesperado." }`.
  Versão síncrona `parseApiErrorSync` (sem Blob) para uso em render.
- `modules/inventory/utils/apiErrorMessage.ts` passa a delegar para
  `parseApiErrorSync` (mesma assinatura).
- `shared/react-query/useCrudMutation.ts`: `onError` padrão exibe
  `toast.error(message)` (sonner) quando o chamador não fornece `onError`.
- `frontend/src/shared/utils/applyFieldErrors.ts`:
  `applyFieldErrors(setError, fieldErrors): boolean` — aplica erros do backend
  aos campos do `react-hook-form`; retorna se aplicou algum. Usado em
  `ProductForm`, `VariantForm`, `CustomerForm`, `InventoryLotForm`,
  `SaleCreatePage`.
- `VariantStock`: inventário inexistente (404) → "Sem estoque"; outra falha →
  "Erro ao carregar estoque".
- Assistente de inventário: decisões baseadas em texto do backend passam a usar
  `code` (ex.: código de barras não encontrado = 404 / `VARIANT_NOT_FOUND`).
- O interceptor 401 do axios (`api.ts`) mantém o redirecionamento ao login.

## 6. Contrato de erro

- Fixtures `frontend/src/test/fixtures/errors/{validation,notFound,conflict,businessRule,internal}.json`
  com o corpo exato de cada tipo; usadas pelos handlers MSW.
- Teste de integração no backend provoca 400, 404, 409, 422 e 500 reais e
  compara o conjunto de chaves com essas fixtures (mesmo mecanismo da Fase 1).

## 7. Testes e aceite

**Backend** (`npm test`):
- `errorHandler`: cada classe → status e corpo; `ZodError`; Prisma P2002/P2025;
  JSON malformado; erro desconhecido → 500 sem a mensagem original no corpo.
- `parseInput`: body, params, query; `errors[].field` com caminho aninhado.
- Por módulo, via `app.inject`: ao menos um 404, e os 409/422 que o módulo
  possui (ex.: catalog 404 produto + 409 código de barras duplicado; customer
  404; auth 401 credenciais + 409 e-mail duplicado; inventory 422 estoque
  insuficiente/limite de caixa + 404; sales 404 cliente/variante; finance 400
  corpo inválido; nfe-import 400 formato não suportado).
- Auth: inicialização sem `JWT_SECRET` falha; 401/403 no formato padrão; rota
  pública com query string continua pública.
- Testes existentes que afirmam mensagens antigas são atualizados.

**Frontend** (`npm test`):
- `parseApiError`: corpo padrão, Blob, rede, desconhecido.
- `applyFieldErrors` em um formulário real (`ProductForm` ou `CustomerForm`)
  mostrando a mensagem no campo.
- `useCrudMutation` mostra toast no erro.
- `VariantStock` com erro → "Erro ao carregar estoque".
- Assistente: 404 com `code` leva ao fluxo "produto não encontrado".

**Aceite:**
- Nenhum controller do escopo com `catch` que responde erro manualmente
  (`grep` documentado no plano).
- Nenhum `throw new Error(` em `domain/` e `application/` dos módulos do escopo.
- Ambas as suítes passam; `tsc` não aumenta (backend ≤ 180, frontend ≤ 43);
  `vite build` passa.
