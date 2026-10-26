# CLAUDE.md — inventory-system

Leia antes de qualquer tarefa. Histórico completo e pendências: `docs/HISTORICO.md`.

## Produto
- ERP de loja: catálogo, estoque por lotes/caixas, vendas, contas a receber/pagar, compras, importação de NF-e, dashboard, CSV.
- UI e mensagens em **PT-BR** (erros da API também). Fala com o usuário em português, frases curtas.
- Precisa funcionar em **celular (360–430 px), tablet e desktop**. Toda mudança de tela é conferida em ~360 px, 768 px e ≥1280 px.
- Papéis: `ADMIN`, `VENDEDOR`, `ESTOQUISTA`.

## Stack e layout
- `backend/`: Node 22, Fastify 5, Prisma 6, PostgreSQL 16, Zod, testes `node:test` via `tsx`, build `tsup`.
  - `src/modules/<m>/{domain,application,infrastructure,interfaces}`; módulos: auth, catalog, customer, dashboard, finance, inventory, nfe-import, purchases, reports, sales.
  - `src/shared/`: transação, erros, idempotência, permissões, http (errorHandler, parseInput, csv), config/env, helpers de domínio (money, businessDate, document, limits).
  - Aliases (`backend/tsconfig.json`): `@shared/*`, `@auth/*`, `@catalog/*`, `@customer/*`, `@inventory/*`, `@finance/*`, `@purchases/*`, `@sales/*`, `@nfe-import/*` (`@receivables/*`/`@payables/*` existem mas apontam para pastas inexistentes).
  - Rotas em `infrastructure/http/routes`, schemas Zod em `interfaces/http/schemas`, registradas em `src/app.ts`.
- `frontend/`: React 19, Vite, TanStack Query, Zustand, Tailwind, Vitest + MSW + jsdom. Alias `@/*` → `src/*`.
  - `src/modules/<m>/{pages,components,hooks,services,...}`; módulos: auth, brands, categories, customers, dashboard, finance, inventory, nfe-imports, payables, products, purchases, receivables, sales, suppliers, users.
  - `src/shared/`: services/api (axios + parseApiError), store (auth, theme), auth (permissions, Can, useCan), react-query (keys, invalidate), components (Modal, ConfirmDialog, DataTable, form/*, layout/*), utils (money, statusTone, idempotencyKey, businessDate), hooks (useMediaQuery/useBreakpoint).
  - Rotas em `src/routes/` (`lazyPage.ts` = code splitting por página).

## Como rodar
```bash
# backend (backend/.env: DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET; ver backend/.env.example)
cd backend && npm run dev                 # tsx watch, porta 3000
npm run test:db:prepare                   # cria/migra inventory_test (idempotente)
npm test                                  # suíte inteira no banco *_test
npx tsx --import ./src/test/bootstrap.ts --test src/modules/x/.../arquivo.test.ts   # um arquivo
npm run typecheck && npm run build && npm start   # dist/server.js
PGCONTAINER=api_db_1 npm run backup-db    # ~/backups/inventory/inventory-AAAAMMDD-HHMMSS.dump
npm run restore-db -- <arquivo.dump> <banco-destino> [--yes]
ADMIN_NAME=.. ADMIN_EMAIL=.. ADMIN_PASSWORD=.. npm run create-admin   # cria/promove/redefine admin
npm run merge-count-lots [-- --apply]     # simulação por padrão
npm run fix-box-stock                    # corrige alocações em caixas acima do saldo
npm run purge-idempotency                 # limpa registros de idempotência vencidos

# frontend
cd frontend && npm run dev                # http://localhost:5173, proxy /api → :3000
npm run dev:https                         # HTTPS autoassinado, para câmera no celular (https://<ip>:5173)
npm test                                  # vitest run
npx vitest run src/caminho/arquivo.test.tsx   # um arquivo
npm run lint && npm run typecheck && npm run build
```
- Antes de declarar pronto: backend `typecheck` + `npm test` (2× quando mexer em concorrência/DB); frontend `lint` (0), `typecheck` (0), `test`, `build`.
- CI (`.github/workflows/ci.yml`): backend em Postgres 16 limpo (`test:db:prepare`, typecheck, test, build, smoke `/health` com NODE_ENV=production); frontend lint/typecheck/test/`vite build`.
- Os servidores de dev do usuário (5173/3000) costumam estar rodando nesta árvore: não mate processos, não troque de branch sem necessidade.

## REGRAS ABSOLUTAS DO BANCO
O banco de dev (`inventory`, container `api_db_1`, volume `api_pgdata`) **foi apagado em 2026-10-23** por `prisma migrate diff --from-migrations --shadow-database-url <dev>` (o Prisma reseta o shadow DB). Não havia backup.
- **NUNCA** use `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push`. Nem em subagente: todo brief que toque migration deve repetir esta proibição.
- Fluxo de migration:
  1. `cd backend && PGCONTAINER=api_db_1 npm run backup-db`.
  2. Escreva o SQL à mão em `prisma/migrations/<AAAAMMDDHHMMSS>_<nome>/migration.sql` (aditivo; confira dados existentes antes de criar CHECK/UNIQUE; se violam, pare e pergunte).
  3. `npx prisma migrate deploy` (dev) e `npm run test:db:prepare` (aplica no `inventory_test`).
  4. `npx prisma generate`.
- Nunca reescreva migration já aplicada (checksum). Banco legado: README raiz, seção "Banco legado".
- Testes só rodam em banco cujo nome termina em `_test` (`src/test/testDatabase.ts`; guarda também em `src/shared/prisma.ts` para arquivo isolado). Em CI vale `DATABASE_URL` com `CI=true`.
- Nunca altere dado do usuário para uma regra "passar" sem decisão dele.

## Arquitetura (backend)
- Clean Architecture: domínio sem Prisma; casos de uso `TransactionalUseCase`; repositórios Prisma resolvem o client por `getDb()`.
- Transação: `PrismaTransactionManager.execute()` + `AsyncLocalStorage` (`shared/infrastructure/prisma/transactionContext.ts`). Chamada aninhada participa da transação externa (a mais externa faz commit). Use cases não recebem `tx`. `lock_timeout` 5 s por transação; deadlock/timeout de trava → 409 `CONCURRENT_UPDATE`.
- Travas `FOR UPDATE` (sempre com transação ativa; mantenha a ordem para não criar ciclo):
  - Estoque: inventário de cada variante em **ordem crescente de productVariantId** → lotes (ORDER BY id) → alocações em caixas. Upsert do inventário = `INSERT … ON CONFLICT DO NOTHING` + `FOR UPDATE`.
  - Venda: itens ordenados por variante; cancelamento: venda (`lockById`) → documento a receber → estoque.
  - Compra: pedido → inventários (crescente) no recebimento; pedido → documento a pagar no cancelamento.
  - Pagamento/estorno: documento financeiro (`lockById`). Documentos por origem: ORDER BY id.
  - NF-e confirmar/descartar/reenviar: rascunho primeiro; mapeamentos por `supplierCode` ordenado. Reverter: importação → pedido → inventários (crescente) → lotes do pedido → alocações → documento a pagar.
  - Catálogo: produto → variantes (por id). Usuários: admins ativos (por id) → alvo.
- Idempotência: POSTs de dinheiro/estoque usam o wrapper `idempotent()` (`shared/http/idempotency/idempotent.ts`); `Idempotency-Key` obrigatório (8–100 `[A-Za-z0-9_-]`), registro na mesma transação, resposta só após commit, replay com `Idempotent-Replayed`. Nova rota desse tipo: envolva com `idempotent()`, adicione no front (`useIdempotencyKey()` / `IdempotencyKeyTracker`: mesma chave enquanto os dados não mudam) e no regex `COVERED_POSTS` de `frontend/src/test/setup.ts` (guarda MSW que falha o teste sem o cabeçalho).
- Helpers (`backend/src/shared/`): `readTogether([...])` (`infrastructure/database/readTogether.ts`) lê consultas em lote (sequencial na conexão da transação quando há uma; `$transaction([...])` fora; monte as consultas com `getDb()`); `createNameSchema({min,max})` (`interfaces/http/schemas/nameSchema.ts`: nome comum, apara e colapsa espaços); `containsLiteral(term)` (`infrastructure/database/literalSearch.ts`: `contains` insensível com `%`/`_`/`\` escapados; use em toda busca por texto); `contentDisposition` (`http/contentDisposition.ts`, cabeçalho de download seguro, replicado no replay de idempotência, que só guarda `location` e `content-disposition`).
- `idempotent(..., { keyOptional: true })`: sem `Idempotency-Key` executa direto (compatibilidade); hoje só `POST /inventory/boxes` usa (o front já envia a chave). Rota nova de dinheiro/estoque: chave obrigatória.
- Senha: máximo de **72 bytes UTF-8** (limite do bcrypt), validado igual no back (`Buffer.byteLength`) e no front (`TextEncoder`) ao criar usuário, redefinir, trocar a própria senha e `create-admin`; login e "senha atual" sem a regra.
- Média de custo: arredondada a 4 casas em `Inventory.receive`; desfazer entrada deixa resíduo ≤ 0,00005 × Q/(Q−q) por unidade (limitação conhecida).
- Datas e horas (instantes) no front: `formatDateTime` fixa `America/Sao_Paulo`; datas só-dia: `formatDateOnly`.
- NF-e com total zero (bonificação): a tela não mostra parcelas e não envia `installments`; não gera conta a pagar.
- Erros: lance classes de `@shared/domain/errors` (`ValidationError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409, `BusinessRuleError` 422, `TooManyRequestsError` 429, `InternalInvariantError` 500) com código de `ErrorCodes` (`errorCodes.ts`) e mensagem em PT. Entrada via `parseInput(schema, data)`. Erro do Postgres 23514 (CHECK) → 409 `CONSTRAINT_VIOLATION`; P2002 deve ser traduzido para o código de negócio no repositório.
- Dinheiro: cálculo sempre em **centavos inteiros** (`toCents`/`fromCents`/`divideCentsRoundHalfUp` em `shared/domain/money.ts`); API trafega reais com ≤ 2 casas; banco `Decimal(12,2)` para valores; **custos unitário e médio são `Decimal(14,4)`** (até 4 casas na API; `roundCost`/`unitCostFromCents`, nunca arredonde custo para 2 casas); front converte texto → centavos (`parseMoneyToCents`). Nunca some float.
- Datas de negócio: fuso `America/Sao_Paulo` (`shared/domain/businessDate.ts`: `todayInBusinessTz`, `businessTodayAsUtcDate`, `businessDateOfInstant`; front `shared/utils/businessDate.ts`). Datas só-dia como `YYYY-MM-DD`.
- Permissões: matriz em `backend/src/shared/auth/permissions.ts`, espelhada em `frontend/src/shared/auth/permissions.ts` (mudar os dois). Rotas usam `authorize(perm)`; `shared/auth/__tests__/routeGate.test.ts` exige permissão em toda rota e `permissions.test.ts` tem `MATRIX` + teste HTTP papel × rota. Rotas públicas: `/auth/login`, `/health`.
- Banco com regras que o Prisma não modela (só nas migrations): CHECKs de estoque/valores (`20261026180000_integrity_checks`), único parcial `FinancialDocument(type, originType, originId) WHERE originType IN ('SALE','PURCHASE') AND status <> 'CANCELED'`, único parcial `Customer(document) WHERE document IS NOT NULL`, únicos `lower(name)` em Brand/Category.
- Contratos: testes HTTP do backend comparam a forma das respostas com `frontend/src/test/fixtures/**` (`src/test/keyShape.ts`). Mudou DTO → atualize a fixture.
- Env (`shared/config/env.ts`): falha na subida listando o inválido. Produção exige `JWT_SECRET` ≥ 32, `CORS_ORIGINS`, `COMPANY_CNPJ`. HSTS só com `NODE_ENV=production`.

## Convenções do frontend
- TanStack Query: chaves só por `queryKeys` (`shared/react-query/keys.ts`). Mutations invalidam os módulos afetados (ex.: venda → sales, receivables, dashboard, `invalidateInventoryQueries`). Sem retry em 4xx.
- Cores: **só tokens do tema** (`bg-surface`, `text-muted`, `success-soft`…, definidos em `index.css`/`tailwind.config.ts`; temas claro/escuro/sistema). `npm run lint` falha em cor crua (classe Tailwind de paleta, hex, rgb) — exceção só com comentário `raw-color-ok`. Status → `toneFor()`/`statusTone` (`shared/utils/statusTone.ts`).
- Cantos e sombras (teste `src/test/designScale.test.ts`): `rounded-lg` em controles/itens, `rounded-xl` em superfícies (cartões, seções, modais), `rounded-full` em pílulas; `shadow` em cartões, `shadow-lg` em camadas flutuantes (modal, menu, lista de opções). Não use `rounded`, `rounded-md`, `rounded-2xl`, `shadow-sm/xl/2xl`.
- Formulários: erro de campo com `<FieldError id=…>` + `{...fieldA11y(id, erro)}` no input (`aria-invalid`/`aria-describedby`); todo `label` com `htmlFor`; botão/link só com ícone leva `aria-label`. Carregamento: `LoadingState` (`shared/components`), não texto solto.
- `Modal` e `ConfirmDialog` renderizam em portal; formulário dentro de Modal chama `useModalBusy(pending)` (ou `busy`) para não fechar durante envio; `ConfirmDialog` usa `loading`.
- `MoneyInput`: texto pt-BR → centavos. "," é decimal, "." é milhar; sem vírgula, ponto + 3 dígitos = milhar ("1.000"), ponto + 1–2 dígitos = decimal ("39.9"); > 2 casas = erro. `QuantityInput`: só inteiros, botões −/+ de 44 px.
- `DataTable`: cada coluna declara `mobile: 'title' | 'subtitle' | 'meta' | 'hidden' | 'actions'`; abaixo de `md` vira cartões.
- Breakpoints `sm 640 / md 768 / lg 1024` (`BREAKPOINTS`, `useBreakpoint`, `useFinePointer`). Testes: `setViewport(width, { pointer })` e `resetViewport()` de `src/test/viewport.ts`; sem chamar, o teste vê desktop.
- Alvos de toque ≥ 44 px; inputs 16 px no celular; autofocus só com ponteiro fino.
- Páginas novas: `lazyPage()` em `src/routes`; guarda por permissão com `RouteGuard`/`Can`.
- Sessão: token em `localStorage` (decisão registrada), sincronizada entre abas (listener `storage`), escritas com try/catch, troca de usuário limpa o cache.

## Regras de negócio em vigor
- Saída de lote automática: **FEFO** (validade mais próxima), depois mais antigo (`createdAt`), depois `id`; lotes sem validade por último.
- Lote vencido (validade < hoje em São Paulo) **não é vendido**; falta coberta só por vencido → 409 `EXPIRED_STOCK_ONLY`; saída manual pode escolher lote (inclusive vencido).
- Mesmo número de lote: custo vira média ponderada; validade/fabricação diferente → 409 `LOT_DATES_MISMATCH`. Lote repetido vindo de NF-e ganha sufixo.
- Contagem (inventário inicial) sem lote soma num lote `CONT-<caixa>-<variante>` (chaveado também pela validade).
- Reserva/liberação exigem `origin` + `originId`; liberar mais que o reservado pelo documento → 409 `RELEASE_EXCEEDS_RESERVATION`. Ajuste abaixo do reservado → 409 `ADJUST_BELOW_RESERVED` listando os documentos.
- Caixas: Σ alocações do lote ≤ `remainingQuantity`; toda baixa abate as alocações mais antigas na mesma transação.
- Preço de venda: só ADMIN (`catalog.price`) altera; sem ela, preço é obrigatório na criação e pode ser definido em variante com preço 0; edição envia só campos alterados.
- Cliente: CPF/CNPJ opcional, único quando informado (`CUSTOMER_DOCUMENT_EXISTS`); CNPJ alfanumérico aceito.
- NF-e: só `finNFe=1`, `tpNF=1`, com `protNFe` e `cStat` 100/150, destinatário = `COMPANY_CNPJ` (se definido) → senão 422 `NFE_NOT_ACCEPTED`. Diferença duplicatas × total ≤ R$ 0,05 ajusta a última parcela; acima → 422 `INSTALLMENTS_TOTAL_MISMATCH`. `nItem` repetido/ausente → `INVALID_NFE`. Mapeamento de fornecedor não grava código vazio nem conflitante.
- Desfazer NF-e: só ADMIN (`purchases.revert`), só se nenhum lote foi consumido e não há pagamento; estorna estoque, cancela pagar e pedido, importação `REVERTED`.
- Venda/compra com pagamento ativo não cancela. Um documento financeiro ativo por origem.
- Login: 10 falhas/15 min por IP+e-mail, 30 por conta, 50 por IP (memória, instância única). Troca de senha derruba sessões antigas.

## Fluxo de trabalho que funcionou
1. Brainstorm/decisões com o usuário (regra de negócio nunca é decidida sozinha; registre a decisão na spec).
2. Spec em `docs/superpowers/specs/AAAA-MM-DD-<nome>-design.md`, plano em `docs/superpowers/plans/`.
3. Branch `feat/…` ou `fix/…`; execução por subagentes por tarefa com TDD (teste que falha antes), revisão por tarefa.
4. Revisão final da branch inteira no modelo mais capaz; corrigir Críticos/Importantes; menores viram lista explícita de adiados.
5. Verificação completa (comandos acima), `git merge --no-ff` na `main`.
6. Push: o remoto HTTPS não tem credencial; use SSH: `git push git@github.com:imtiago/inventory-system.git main`.
7. CI: `gh` não está instalado; consulte `curl -s "https://api.github.com/repos/imtiago/inventory-system/actions/runs?branch=main&per_page=1"`.
8. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## QA visual (headless)
- Ferramentas versionadas em `tools/visual-qa/` (uso resumido abaixo; README com o passo a passo): mock da API a partir de `frontend/src/test/fixtures/**` (`server.mjs`, porta 4400), capturas por CDP em 375/768/1280/1440/1920 nos temas claro e escuro (`run.mjs`, `interact.mjs`) e relatório de contraste (`contrast.mjs`, falha abaixo de 4,5/3).
- Resumo: `cd frontend && npx vite build --outDir <tmp>/dist --emptyOutDir`; `node tools/visual-qa/server.mjs <tmp>/dist`; `node tools/visual-qa/run.mjs --out <tmp>/shots --widths 375,1440`; `node tools/visual-qa/contrast.mjs`. Chrome em `/usr/bin/google-chrome`; portas 4400/4401 (nunca 5173/3000).
- Confira `main.scrollWidth <= clientWidth` (o `run.mjs` já falha se houver rolagem horizontal) e os dois temas. Rota ou endpoint novo: atualize `pages.mjs` / `route()` do `server.mjs`.

## Armadilhas conhecidas
- `pg_dump` local é 14 e o servidor 16: backup sempre com `PGCONTAINER=api_db_1`.
- Testes rodam arquivos em paralelo no mesmo banco: asserções só sobre os próprios fixtures (ids/códigos aleatórios), nunca contagens globais; janelas de data dedicadas no dashboard.
- Agentes em worktree (`.claude/worktrees/`) não escrevem no `.superpowers/` da árvore principal; `.superpowers/` está em `.git/info/exclude` (não versionado).
- `npm run dev` é HTTP; câmera no celular exige `npm run dev:https`. HSTS só em produção (senão o navegador força HTTPS no localhost).
- No WSL o celular precisa de `netsh portproxy` (README raiz).
- Não use `prisma migrate diff` (qualquer forma): já apagou o banco uma vez; escreva o SQL à mão olhando o `schema.prisma`.
- Migration nova roda também em CI num banco vazio: precisa funcionar sem dados e com dados.
- Não rode o seed (`prisma/seed.ts`, `npx prisma db seed`): grava clientes fictícios em qualquer banco.
