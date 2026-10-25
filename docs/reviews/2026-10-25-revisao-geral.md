# Revisão geral do código — 2026-10-25

Varredura somente leitura de todos os módulos (backend e frontend), feita por 8 revisores, cada um verificando os achados no código. Base: `main` em `4b10ed0`.

## Resumo

| Área | Crítico | Alto | Médio | Baixo |
|---|---|---|---|---|
| Backend — comum, autenticação, banco, CI | 0 | 2 | 7 | 8 |
| Backend — catálogo e clientes | 0 | 1 | 5 | 9 |
| Backend — estoque | 0 | 3 | 8 | 9 |
| Backend — vendas, financeiro, dashboard, relatórios | 0 | 1 | 4 | 8 |
| Backend — compras e NF-e | 0 | 1 | 6 | 8 |
| Frontend — comum, login, usuários, dashboard | 0 | 1 | 6 | 6 |
| Frontend — catálogo, clientes, estoque | 0 | 2 | 10 | 7 |
| Frontend — vendas, financeiro, compras, NF-e | 0 | 0 | 3 | 8 |
| **Total** | **0** | **11** | **49** | **63** |

Nenhum problema crítico. Os 11 de severidade alta estão detalhados nas seções abaixo, marcados com `[Alto]`.


---

## Revisão 01 — Backend: transversal (shared), auth, schema/migrations, testes e CI

Escopo: `backend/src/shared/**`, `backend/src/modules/auth/**`, `app.ts`, `server.ts`, `scripts/**`, `test/**`, `prisma/**`, `package.json`, CI e READMEs. `npx tsc --noEmit` passou sem erros. O comportamento de CORS e do tratamento de erros foi confirmado com `app.inject` (preflight OPTIONS, rota inexistente, JSON malformado), sem tocar no banco.

## [Alto] Trocar ou redefinir a senha não invalida os tokens já emitidos
- Onde: `backend/src/shared/middleware/auth.ts:45-55`, `backend/src/modules/auth/application/useCases/commands/ResetUserPasswordUseCase.ts:18-24`, `ChangeOwnPasswordUseCase.ts:40`, `backend/src/modules/auth/infrastructure/security/JwtTokenService.ts:9`
- Problema: `authenticate` confere no banco só se o usuário existe e está `active`. Nada amarra o token à senha atual: não há `tokenVersion`/`passwordChangedAt` comparado com o `iat`. O token HS256 vale 8 h e não pode ser revogado.
- Impacto para quem usa/opera o sistema: quando um administrador redefine a senha de uma conta comprometida (`POST /users/:id/password`), ou o próprio usuário troca a senha por suspeita de vazamento, quem já tem o token continua dentro do sistema por até 8 h, com as permissões do papel (vendas, pagamentos, estornos). Hoje a única saída imediata é desativar o usuário.
- Sugestão: adicionar `passwordChangedAt` (ou `tokenVersion`) em `users`, gravar o valor na troca/redefinição de senha e, em `authenticate`, rejeitar tokens com `iat` anterior (ou `ver` diferente). `PrismaSessionUserReader` já lê a linha a cada requisição, então o custo extra é nulo.

## [Alto] Não existe build/start de produção nem desligamento gracioso
- Onde: `backend/package.json:6-13` (só `dev: tsx watch`), `backend/src/server.ts:4-14`, `backend/src/shared/prisma.ts:3`
- Problema: não há script `build`/`start`. Os aliases de caminho (`@shared/*`, `@auth/*`…) só se resolvem com `tsx`, que é devDependency, então a única forma documentada de subir a API é o modo watch. O `server.ts` não trata SIGTERM/SIGINT (`app.close()`, `prisma.$disconnect()`), a porta é fixa (`3000`) e o host é fixo (`0.0.0.0`).
- Impacto para quem usa/opera o sistema: em produção a API roda com watcher de arquivos e transpilação em tempo de execução. Em cada deploy ou restart do container, as requisições em andamento (vendas, pagamentos) são cortadas no meio, e o cliente recebe erro de conexão sem saber se a operação foi gravada. A idempotência ajuda, mas só nas rotas que a usam. Também não dá para mudar a porta por ambiente.
- Sugestão: criar `build` (tsc + resolução de aliases, ex.: `tsc-alias`, ou bundle com `tsup`/esbuild) e `start` (`node dist/server.js`). Ler `PORT`/`HOST` do ambiente. Registrar handlers de SIGTERM/SIGINT que chamem `await app.close()` e um hook `onClose` com `prisma.$disconnect()`.

## [Médio] Limitador de login em memória, por IP+e-mail e sem `trustProxy`
- Onde: `backend/src/modules/auth/infrastructure/security/LoginAttemptLimiter.ts:10-16,88`, `AuthenticateUserUseCase.ts:21-27`, `AuthenticateUserController.ts:14` (`request.ip`), `backend/src/app.ts:22-24` (Fastify sem `trustProxy`)
- Problema: (1) Atrás de um proxy reverso (nginx, load balancer), `request.ip` é sempre o IP do proxy, porque `trustProxy` não está configurado. A chave vira, na prática, só o e-mail. (2) A chave é IP+e-mail, e não existe limite por IP nem por conta isoladamente: um atacante pode tentar 10 senhas por e-mail a cada 15 min, para quantos e-mails quiser (password spraying), ou distribuir as tentativas por vários IPs contra a mesma conta. (3) O estado fica em memória: é zerado a cada restart e não é compartilhado entre instâncias.
- Impacto para quem usa/opera o sistema: atrás de proxy, qualquer pessoa consegue bloquear o login do administrador para todos por 15 min, basta errar a senha dele 10 vezes. Sem proxy, a proteção contra força bruta distribuída é fraca.
- Sugestão: configurar `trustProxy` de acordo com a infraestrutura. Somar um limite por IP (todas as contas) e um limite por conta (todos os IPs), este com backoff em vez de bloqueio total. Se houver mais de uma instância, guardar os contadores em armazenamento compartilhado (tabela no Postgres ou Redis).

## [Médio] `JWT_SECRET` aceito com qualquer tamanho; configuração do ambiente não é validada
- Onde: `backend/src/shared/config/env.ts:5-11`, `backend/src/modules/auth/infrastructure/security/JwtTokenService.ts:12-16`
- Problema: `loadEnv` só confere se `JWT_SECRET` existe. Um segredo curto ou previsível (ex.: `segredo`, ou `ci-only-secret` copiado do CI) é aceito sem aviso. Com HS256, um segredo fraco pode ser descoberto offline a partir de um único token capturado, e aí dá para forjar `sub` de qualquer usuário (o papel vem do banco, mas o `sub` de um ADMIN basta). `DATABASE_URL`, `PORT` e `NODE_ENV` também não são validados no início. Não há `.env.example` (o README só diz "crie backend/.env com as chaves").
- Impacto para quem usa/opera o sistema: uma instalação feita às pressas pode ficar com tokens forjáveis sem que ninguém perceba. Configuração errada só aparece na primeira requisição, e não na subida.
- Sugestão: validar o ambiente com Zod em `env.ts` (`JWT_SECRET` com ≥ 32 caracteres/bytes aleatórios, `DATABASE_URL` como URL, `PORT` numérico) e falhar na subida. Fornecer `backend/.env.example` e documentar como gerar o segredo (`openssl rand -base64 48`).

## [Médio] Testes de integração escrevem no banco de `DATABASE_URL` (o banco de desenvolvimento), sem nenhuma proteção
- Onde: `README.md:38`, `backend/src/test/authFixtures.ts:41-70`, `backend/src/test/inventoryFixtures.ts:89-97`, `backend/src/shared/http/idempotency/__tests__/idempotency.test.ts:292`, `backend/package.json:7`
- Problema: `npm test` carrega o `.env` e roda os arquivos de teste em paralelo contra o mesmo banco usado no desenvolvimento. Nada impede que rode contra um banco real, por exemplo se o `.env` apontar para produção. As fixtures deixam resíduos permanentes: o `cleanup` desativa o usuário quando uma FK impede o delete, e `getTestUserId` cria um ADMIN ativo fixo `tx-test-inventory@local`. Os testes também consomem as faixas de `NumberRange` (códigos de venda e de compra pulam) e `purgeIdempotencyRecords()` apaga registros reais de idempotência vencidos.
- Impacto para quem usa/opera o sistema: o banco de desenvolvimento acumula usuários `tx-test-*`, inclusive um ADMIN ativo que conta na regra de "último administrador", e lacunas na numeração. Rodar os testes por engano num banco de produção sujaria dados reais. Testes que dependem de agregados globais podem ficar instáveis conforme os dados de desenvolvimento.
- Sugestão: usar uma variável separada (`TEST_DATABASE_URL`) e abortar os testes se o nome do banco não terminar em `_test` (ou equivalente). Documentar a criação desse banco com `prisma migrate deploy`. O CI já usa um banco descartável (`inventory_ci`).

## [Médio] Faltam índices para consultas por origem e por histórico
- Onde: `backend/prisma/schema.prisma:227-263` (`StockMovement` sem nenhum índice), `:341-357` (`FinancialDocument` sem índice em `originType/originId` nem em `partyId`), `:265-285` (`Sale.customerId`/`sellerId`), `:474-484` (`PurchaseItem.purchaseId`). As consultas estão em `PrismaStockMovementRepository.ts:68` (`origin, originId`), `PrismaSaleReadRepository.ts:49` (`type, originType, originId`) e `PrismaStockMovementReadRepository.ts:35,72` (ordenação por `createdAt`).
- Problema: o Postgres não cria índice automático para FK. Todas essas buscas são varreduras completas, e várias rodam dentro de transações com travas (cancelamento de venda, recebimento).
- Impacto para quem usa/opera o sistema: com o crescimento do histórico (movimentações de estoque, documentos financeiros), abrir uma venda, cancelar e listar movimentações ficam progressivamente lentos. Transações mais longas aumentam os 409 `CONCURRENT_UPDATE` por `lock_timeout`.
- Sugestão: nova migration com `@@index([originType, originId])` e `@@index([partyType, partyId])` em `FinancialDocument`, `@@index([origin, originId])`, `@@index([productVariantId, createdAt])` e `@@index([createdAt])` em `StockMovement`, `@@index([customerId])` em `Sale` e `@@index([purchaseId])` em `PurchaseItem`. Em produção, criar com `CREATE INDEX CONCURRENTLY`, numa migration à parte.

## [Médio] Nenhuma restrição CHECK nem unicidade de origem no banco para invariantes de dinheiro/estoque
- Onde: `backend/prisma/schema.prisma:204-225` (`Inventory.quantity`, `reservedQuantity`), `:166-202` (`InventoryLot.remainingQuantity`), `:359-403` (`FinancialParcel.amount`, `Payment.amount`), `:341-357` (`FinancialDocument` sem `@@unique([type, originType, originId])`). Nenhuma migration cria `CHECK` (conferido por grep em `prisma/migrations`).
- Problema: as regras (estoque ≥ 0, reservado ≤ quantidade, valores > 0, um documento financeiro por venda/compra) existem só na aplicação. Um bug, uma corrida não coberta por trava ou um script manual pode gravar estado inválido sem erro algum.
- Impacto para quem usa/opera o sistema: estoque negativo ou um segundo "a receber" duplicado para a mesma venda passariam despercebidos até aparecerem como divergência nos relatórios.
- Sugestão: migration com `CHECK ("quantity" >= 0)`, `CHECK ("reservedQuantity" BETWEEN 0 AND "quantity")`, `CHECK ("remainingQuantity" >= 0)`, `CHECK ("amount" > 0)` e índice único parcial em `FinancialDocument (type, "originType", "originId") WHERE "originType" IN ('SALE','PURCHASE')`, depois de verificar que os dados atuais respeitam essas regras.

## [Médio] Migrations que falham ou abortam num banco com dados
- Onde: `backend/prisma/migrations/20261021022145_nome_da_alteracao/migration.sql:10-13`, `backend/prisma/migrations/20261023180000_user_active_email_normalized/migration.sql:5`
- Problema: (1) `nome_da_alteracao` (nome provisório) adiciona `Customer.code TEXT NOT NULL` sem default nem backfill. O próprio aviso do Prisma no arquivo diz que "não é possível se a tabela não estiver vazia". (2) `UPDATE users SET email = lower(trim(email))` viola `users_email_key` se houver dois e-mails que diferem só em caixa/espaço, e a migration aborta.
- Impacto para quem usa/opera o sistema: qualquer banco que já tinha clientes antes de outubro (homologação, cópia de produção) não consegue aplicar `prisma migrate deploy`, e o deploy para nessa migration até alguém intervir à mão.
- Sugestão: se ainda não houver banco de produção com essas migrations aplicadas, corrigir as migrations (backfill do `code` a partir da faixa `CUSTOMER`, deduplicação dos e-mails antes do UPDATE). Se já houver, documentar no README o procedimento manual (`prisma migrate resolve`) para bancos legados.

## [Médio] Sem rate limit global, cabeçalhos de segurança, health check ou limites explícitos
- Onde: `backend/src/app.ts:22-60`
- Problema: não há `@fastify/rate-limit`, `@fastify/helmet` nem rota `/health` (toda rota sem token responde 401, conforme o hook global em `app.ts:38-42`), e `bodyLimit`/`connectionTimeout` não são configurados (ficam os defaults). Só o login tem limitação.
- Impacto para quem usa/opera o sistema: um usuário autenticado (ou um script com token vazado) pode disparar exportações CSV e relatórios pesados sem limite e esgotar o pool de conexões do Prisma. Orquestradores e balanceadores não têm como checar se a API e o banco estão vivos.
- Sugestão: registrar `@fastify/rate-limit` (limite por usuário/IP, mais baixo em `/reports` e exportações) e `@fastify/helmet`. Criar `GET /health` público, com `SELECT 1`, incluído em `publicRoutes`.

## [Baixo] CORS reflete qualquer origem (`origin: true`)
- Onde: `backend/src/app.ts:27-32`
- Problema: confirmado com `app.inject`: um preflight de `Origin: http://evil.example` recebe `access-control-allow-origin: http://evil.example` com `authorization` permitido. Como a autenticação é por Bearer (sem cookies e sem `credentials`), isso sozinho não permite CSRF. Mas qualquer site pode chamar a API se obtiver um token (ex.: via XSS em outro site da mesma pessoa, extensões).
- Impacto para quem usa/opera o sistema: proteção em profundidade ausente. Se um token vazar, nenhuma barreira de origem limita onde ele pode ser usado pelo navegador.
- Sugestão: ler a lista de origens permitidas de `CORS_ORIGINS` no ambiente (ex.: o domínio do front) e usar `origin: [..]`.

## [Baixo] Senhas com mais de 72 bytes são truncadas silenciosamente
- Onde: `backend/src/modules/auth/interfaces/http/schemas/createUserSchema.ts:4-10`, `BcryptPasswordHasher.ts:10-12`
- Problema: o limite `max(72)` conta caracteres, mas o bcrypt (bcryptjs 3.0.3, que tem `truncates()`) usa só os primeiros 72 **bytes** UTF-8. Uma senha com acentos ou emoji dentro de 72 caracteres pode passar de 72 bytes, e a parte final é ignorada. A política também é só "≥ 8 caracteres".
- Impacto para quem usa/opera o sistema: na prática, raro. Uma senha longa com acentos fica mais fraca do que parece, sem aviso.
- Sugestão: validar `Buffer.byteLength(senha, "utf8") <= 72` (ou usar `bcrypt.truncates`) com mensagem clara. Considerar uma lista de senhas comuns proibidas.

## [Baixo] Erros 4xx do Fastify perdem o significado; esgotar o pool vira 500
- Onde: `backend/src/shared/http/errorHandler.ts:125-136`, `:34-55`
- Problema: todo erro do Fastify com status 4xx (413 corpo grande demais, 415 content-type, JSON malformado) responde "Requisição inválida." / `BAD_REQUEST`. O status é mantido, mas a mensagem não diz o que houve (confirmado: JSON malformado → `400 BAD_REQUEST`). `P2028` por `maxWait` ("Unable to start a transaction in the given time", pool esgotado) não é mapeado e vira 500 genérico. A detecção de 55P03/40P01 em `PrismaClientUnknownRequestError` depende do texto interno da mensagem do Prisma (`PG_CODE_IN_MESSAGE`, linha 32), que pode mudar numa atualização.
- Impacto para quem usa/opera o sistema: o usuário que envia um XML grande demais vê "Requisição inválida." em vez de "arquivo grande demais". Sob carga, o usuário vê "Erro interno" em vez de "tente novamente".
- Sugestão: mapear 413 e 415 para mensagens específicas e o P2028 de `maxWait` para 503 com `code: "SERVICE_BUSY"`. Ter um teste que trave a dependência do formato da mensagem do Prisma, para a quebra aparecer na atualização de versão.

## [Baixo] Replay de idempotência não reproduz cabeçalhos; headers vão ao cliente antes do commit
- Onde: `backend/src/shared/http/idempotency/idempotent.ts:117-122,198-201`, `PrismaIdempotencyStore.ts:55-66`
- Problema: o proxy só captura `status`/`send`. Outras chamadas (`reply.header(...)`) vão direto para o reply real dentro da transação, e só status + corpo são gravados. No replay, cabeçalhos como `Location` não são reproduzidos. Se a transação falhar depois de o controller definir um header, esse header fica no reply e vai junto da resposta de erro.
- Impacto para quem usa/opera o sistema: hoje baixo, porque as rotas idempotentes respondem JSON sem cabeçalhos especiais. Vira armadilha para quem acrescentar um header numa rota idempotente.
- Sugestão: capturar também `header`/`headers` no proxy e persistir uma lista permitida de cabeçalhos junto com o corpo, ou documentar a restrição no JSDoc de `idempotent`.

## [Baixo] `onDelete: Cascade` em histórico financeiro
- Onde: `backend/prisma/schema.prisma:370` (`FinancialParcel → FinancialDocument`), `:400` (`Payment → FinancialParcel`), `:304` (`SaleItem → Sale`), `:479` (`PurchaseItem → Purchase`)
- Problema: apagar um documento financeiro apaga em cascata parcelas e pagamentos (inclusive os estornados, que são trilha de auditoria). Hoje nenhum código apaga essas tabelas (grep sem resultados), então o risco é latente: um script manual, um endpoint futuro ou um `DELETE` de suporte.
- Impacto para quem usa/opera o sistema: perda silenciosa do histórico de recebimentos/pagamentos num único comando.
- Sugestão: trocar para `Restrict` em `Payment.parcel` e `FinancialParcel.document`. O sistema já trabalha com cancelamento lógico.

## [Baixo] Precisão de custo inconsistente: `Decimal` sem escala
- Onde: `backend/prisma/schema.prisma:185` (`InventoryLot.unitCost`), `:215` (`Inventory.averageCost`), `:248` (`StockMovement.averageCost`), migration `20261022161112_inventory_movement_history` (`DECIMAL(65,30)`)
- Problema: preços e totais usam `DECIMAL(12,2)`, mas custos de lote e custo médio ficam com `DECIMAL(65,30)`. As dízimas do custo médio ficam com 30 casas, e o arredondamento passa a depender de cada consumidor.
- Impacto para quem usa/opera o sistema: pequenas diferenças de centavos entre custo exibido, relatórios e CSV, conforme o lugar onde o valor é arredondado.
- Sugestão: definir uma precisão explícita (ex.: `@db.Decimal(14,4)` para custo médio, `(12,2)` para custo de lote) numa migration com `USING round(...)`.

## [Baixo] Dependências e configurações mortas; CI sem verificação de drift do schema
- Onde: `backend/package.json:29-46` (`jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `ts-node-dev` sem uso, conferido por grep), `backend/jest.config.js` (CommonJS `module.exports` num pacote `"type": "module"`), `backend/package.json:13` (script `projesctStructure`), `backend/src/shared/http/response.ts` (`HttpResponse.notFound` com mensagem em inglês), `.github/workflows/ci.yml:41-46`
- Problema: código e dependências mortos aumentam a superfície de `npm audit` e confundem quem chega ao projeto. O CI não roda `prisma validate`/`prisma migrate diff --from-migrations ... --to-schema-datamodel` num banco descartável, nem lint no backend. Uma mudança no `schema.prisma` sem migration correspondente passa no CI.
- Impacto para quem usa/opera o sistema: risco de o schema do código divergir do banco migrado em produção, com erro só em tempo de execução.
- Sugestão: remover as dependências e o `jest.config.js`. No job de CI (que já tem Postgres descartável), acrescentar `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url $DATABASE_URL --exit-code`. Isso só no banco efêmero do CI, nunca no banco de desenvolvimento.

## [Baixo] Seed grava clientes fictícios em qualquer banco
- Onde: `backend/prisma/seed.ts:10-14`, `backend/prisma/seeds/customer.seed.ts`
- Problema: `prisma db seed` cria clientes de exemplo ("João Silva"…), consumindo a faixa `CUSTOMER`, sem distinguir ambiente.
- Impacto para quem usa/opera o sistema: se o seed for rodado em produção para criar faixas e marcas, entram clientes falsos nas listas e relatórios.
- Sugestão: separar o seed de dados de referência (faixas de numeração) do seed de demonstração, ou exigir `SEED_DEMO=true` para os clientes.

## Pontos fortes
- Autenticação robusta no essencial. O JWT é verificado com algoritmo fixo (`HS256`), `issuer` e `audience`. A sessão é conferida no banco a cada requisição: o papel vem do banco e a desativação vale na hora. O login usa hash fictício para não revelar se o e-mail existe nem se a conta está inativa.
- Autorização centralizada e auditável. `authorize()` marca os handlers, e existe um teste de cobertura das rotas (`routeGate.test.ts`). `hasPermission` usa `Object.hasOwn` contra chaves como `__proto__`. A regra de "último administrador" usa travas em ordem fixa (`countActiveAdminsExcluding` + `findByIdForUpdate`).
- Transações bem desenhadas. `AsyncLocalStorage` + `getDb()` deixam os repositórios participarem da transação externa. `lock_timeout` é aplicado com `set_config(..., true)` (local à transação), e deadlock/lock timeout viram 409 `CONCURRENT_UPDATE`.
- Idempotência sólida. O registro é gravado na mesma transação da operação (`INSERT ... ON CONFLICT DO NOTHING` + `FOR UPDATE`), o hash do pedido é canônico, o escopo é por usuário + rota, e a resposta só é enviada depois do commit. A limpeza é feita fora da transação, com `SKIP LOCKED`.
- Nenhum SQL concatenado com entrada do usuário. Todo `$queryRaw` usa template com parâmetros, e o `Prisma.raw` só aparece com identificadores fixos (`brandCategorySql.ts`). O CSV neutraliza fórmulas (`=+-@`). O tratador de erros nunca devolve mensagem interna ao cliente.
- Migrations recentes são aditivas, com backfill antes do `NOT NULL`. O CI aplica `migrate deploy` num Postgres descartável e roda typecheck e testes.

## Não verificado
- Se o `prisma migrate dev` tentaria remover os índices de expressão `Brand_name_lower_key`/`Category_name_lower_key`, que não estão modelados no schema. Não rodei, por ser proibido; vale conferir no banco efêmero do CI com `migrate diff`.
- Se algum teste de integração depende de agregados globais (dashboard, relatórios) e fica instável com dados de desenvolvimento. Não rodei a suíte completa, porque ela escreve no banco de desenvolvimento.
- Como a API é publicada (proxy reverso ou não). Isso define a gravidade real do problema de `trustProxy` no limitador de login.
- Limites do `@fastify/multipart` nas rotas de NF-e (escopo de outro revisor).
- Onde o front guarda o token (localStorage ou memória), o que influencia o risco do CORS aberto.

---

## Auditoria backend: catalog + customer

Caminhos abaixo relativos a `backend/src/modules/`, salvo indicação.

## [Alto] Preço de venda sem teto: valor grande vira 500
- Onde: catalog/interfaces/http/schemas/createVariantSchema.ts:10-13 (salePriceSchema); backend/prisma/schema.prisma:152 (`Decimal(12,2)`)
- Problema: o schema só exige `>= 0` e no máximo 2 casas decimais. A coluna aceita até 9.999.999.999,99. Um valor maior (ex.: 1e12) passa na validação e estoura no banco com erro de overflow numérico, que o errorHandler não mapeia (só P2002, P2003, P2025 e concorrência). O mesmo vale para `Infinity` ou números enormes vindos do JSON.
- Impacto para quem usa o sistema: erro 500 genérico ao digitar um preço com zeros a mais. A tela não consegue mostrar um erro de campo.
- Sugestão: `.max(9_999_999_999.99)` no `salePriceSchema`, que é compartilhado por create e update de variante. Idealmente trabalhar em centavos inteiros ou Decimal e não em float.

## [Médio] Código de barras: corrida vira 409 genérico e não há limite de tamanho
- Onde: catalog/application/useCases/commands/CreateVariantUseCase.ts:35-43, UpdateVariantUseCase.ts:29-37, CreateProductUseCase.ts:52-54; schemas createVariantSchema.ts:18 e updateVariantSchema.ts:7-10; backend/src/shared/http/errorHandler.ts:115
- Problema: a unicidade é checada no código (`findByBarcode`) e o banco tem `@unique`. Em corrida, o P2002 do Prisma não é traduzido pelos repositórios (diferente de Brand/Category, que usam `mapUniqueName`). O errorHandler devolve `{code:"CONFLICT","Registro já existe."}` em vez de `BARCODE_ALREADY_EXISTS`. Além disso o `barcode` não tem `.max()`: uma string enorme chega ao índice btree e pode falhar com erro de tamanho de linha de índice (500).
- Impacto para quem usa o sistema: dois operadores cadastrando o mesmo código ao mesmo tempo recebem uma mensagem diferente da do caso normal, e o front que depende de `BARCODE_ALREADY_EXISTS` não destaca o campo. Código de barras gigante causa 500.
- Sugestão: capturar P2002 com target `barcode` em `PrismaProductVariantRepository.create/update` e lançar o ConflictError com o código certo. Adicionar `.max(64)` (ou o tamanho real) nos dois schemas.

## [Médio] Variantes sem índice em `productId`; produtos sem índice em `brandId`/`categoryId`
- Onde: backend/prisma/schema.prisma:129-164 (nenhum `@@index`); catalog/infrastructure/prisma/contracts/PrismaProductVariantReadRepository.ts:18-31, PrismaProductReadRepository.ts:31-32, brandCategorySql.ts:70
- Problema: o Postgres não cria índice automático em FK. `ProductVariant.productId` é filtrado na listagem de variantes, em `lockByProduct` (FOR UPDATE) e em `deleteWithInventory`. `Product.brandId` e `Product.categoryId` são usados no filtro da listagem, no `productsCount` (subquery correlacionada por linha, executada para cada marca/categoria listada) e em `countProducts` na exclusão. Nenhuma migration de índice foi encontrada para essas colunas (grep em prisma/migrations).
- Impacto para quem usa o sistema: lentidão que cresce com o catálogo. Listagem de marcas/categorias com contagem, abertura de produto e exclusão passam a varrer a tabela inteira, e os locks de exclusão seguram mais linhas por mais tempo.
- Sugestão: `@@index([productId])` em ProductVariant e `@@index([brandId])` / `@@index([categoryId])` em Product, via migration nova.

## [Médio] Edição de produto e variante sem trava: atualização perdida
- Onde: catalog/application/useCases/commands/UpdateProductUseCase.ts:26-48, UpdateVariantUseCase.ts:22-39; infrastructure/prisma/mappers/ProductMapper.ts:32-43, ProductVariantMapper.ts:31-40
- Problema: lê a entidade, altera em memória e grava todos os campos (`toUpdatePersistence` inclui `code`, `name`, `description`, `brandId`, `categoryId` / `salePrice`, `barcode`) sem `FOR UPDATE` nem versão. Duas edições parciais concorrentes (uma muda o preço, outra o nome) gravam o valor antigo por cima uma da outra. Em `UpdateProduct`, a marca/categoria validada pode ser excluída entre a checagem e o update, o que só é protegido pela FK (P2003, tratado como 409 pelo handler).
- Impacto para quem usa o sistema: uma alteração de preço pode sumir silenciosamente quando outro usuário edita a mesma variante ao mesmo tempo.
- Sugestão: gravar só os campos alterados (como `PrismaCustomerRepository.update` já faz), ou travar a linha (`lockById` já existe para produto) antes de ler.

## [Médio] Perfil VENDEDOR altera preço de venda e catálogo
- Onde: backend/src/shared/auth/permissions.ts:33-34; catalog/infrastructure/http/routes/productVariantsRoutes.ts:19-23, brandRoutes.ts:10-13
- Problema: `catalog.write` cobre criar/editar produto, marca, categoria e `PUT /variants/:id` (que altera `salePrice`). VENDEDOR e ESTOQUISTA têm `catalog.write`; só a exclusão fica restrita a ADMIN. Não há permissão separada para preço.
- Impacto para quem usa o sistema: um vendedor pode mudar o preço de qualquer item no catálogo e renomear marcas/categorias globais. É um risco de fraude ou erro operacional, se essa não for a regra de negócio desejada.
- Sugestão: confirmar com o negócio. Se não for intencional, criar `catalog.price` (ou limitar `catalog.write` do VENDEDOR a leitura) e proteger a rota de variante.

## [Médio] Clientes sem nenhuma unicidade ou documento fiscal
- Onde: backend/prisma/schema.prisma:311-320; customer/application/useCases/commands/CreateCustomerUseCase.ts:25-41
- Problema: só `code` é único (gerado). Não existe CPF/CNPJ, e e-mail e telefone podem repetir. Não há checagem de duplicidade nem de nome igual. Para um ERP brasileiro com NF-e/vendas, não há identificador de cliente.
- Impacto para quem usa o sistema: o mesmo cliente é cadastrado várias vezes, dividindo histórico, saldo em aberto e vendas; não dá para emitir documento fiscal com identificação do comprador.
- Sugestão: decidir a chave natural (CPF/CNPJ opcional, único quando preenchido) e, no mínimo, alertar duplicidade de e-mail/telefone. Tratar P2002 nos repositórios.

## [Baixo] Create/Update de variante: resposta lida fora da transação pode virar `data: null`
- Onde: catalog/infrastructure/http/controllers/CreateVariantController.ts:24-27, UpdateVariantController.ts:21-24; queries/GetProductVariantByIdUseCase.ts
- Problema: o controller executa o comando (transação commitada) e depois chama `useCaseGet.execute`, que devolve `null` se não achar. Se a variante for excluída entre as duas chamadas, responde 201/200 com `data: null`. Product/Brand/Category fazem a leitura dentro da transação do use case; aqui o padrão difere e há uma segunda ida ao banco.
- Impacto para quem usa o sistema: raro, mas o front recebe sucesso sem dados e pode quebrar.
- Sugestão: devolver o DTO a partir do use case, com leitura na mesma transação (como `CreateProductUseCase`). Os outputs `IProductVariantOutput` dos use cases ficam sem uso real.

## [Baixo] Produto criado pela API sempre nasce com variante "Padrão", preço 0 e sem código de barras
- Onde: catalog/interfaces/http/schemas/productSchemas.ts:30-35 vs application/dto/ProductDTO.ts:19-20 e CreateProductUseCase.ts:50-64
- Problema: o use case aceita `variant` (nome, barcode, preço) e o `CatalogWriteService` (NF-e) usa isso, mas o schema HTTP não expõe o campo. Quem cria via HTTP precisa de uma segunda chamada (`PUT /variants/:id`) para definir preço e código de barras. Também: a checagem de barcode ocorre depois do `INSERT` do produto e da geração do código (desperdício; reverte pela transação, mas a sequência pode ter lacunas dependendo do gerador).
- Impacto para quem usa o sistema: produto fica "vendável a R$ 0,00" entre as duas chamadas; o fluxo de cadastro exige dois passos.
- Sugestão: expor `variant` opcional no schema HTTP (com `salePriceSchema`/barcode) ou documentar explicitamente o fluxo; validar o barcode antes de gerar códigos.

## [Baixo] Validação de nome inconsistente e variante sem normalização
- Onde: catalog/interfaces/http/schemas/createVariantSchema.ts:16, updateVariantSchema.ts:6, productSchemas.ts:4-8, brandCategorySchemas.ts:6-14, customer/interfaces/http/schemas/customerSchemas.ts:8-16
- Problema: nome de variante não tem `trim`, nem `max`, nem colapso de espaços (`"  Azul "` é salvo como veio; `"   "` passa no schema e só falha no domínio). Produto usa `.trim().min(3).max(120)`, marca/categoria `normalizeWhitespace` 1–80, cliente 2–120. Não há unicidade de nome de variante dentro do produto (dois "Padrão" são possíveis). Produto também permite nomes duplicados sem aviso.
- Impacto para quem usa o sistema: lista de variantes com nomes repetidos ou com espaços; mensagens de erro diferentes para o mesmo tipo de campo.
- Sugestão: reaproveitar um `nameSchema` comum com `normalizeWhitespace` e `max`; considerar unicidade (produtoId, lower(name)) para variantes.

## [Baixo] Exclusão de variante apaga mapeamentos de fornecedor (NF-e) sem avisar
- Onde: catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository.ts:107-123 (findInUse) e backend/prisma/schema.prisma:586 (`onDelete: Cascade`)
- Problema: `findInUse` não considera `SupplierProductMapping`; ao excluir a variante, o mapeamento código do fornecedor → variante some em cascata. Também não há verificação de rascunhos de importação de NF-e que referenciem a variante (não verifiquei os campos).
- Impacto para quem usa o sistema: a próxima importação de NF-e daquele fornecedor perde o vínculo aprendido e pede mapeamento de novo.
- Sugestão: documentar o efeito, ou bloquear/avisar quando existir mapeamento.

## [Baixo] Busca por `contains` do Prisma tratada de forma diferente em produto e cliente
- Onde: catalog/infrastructure/prisma/contracts/PrismaProductReadRepository.ts:21-30 vs customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository.ts:21-26 vs brandCategorySql.ts:63-64 (strpos)
- Problema: o cliente escapa `\ % _` manualmente antes de `contains`; o produto passa o termo cru; marca/categoria usam `strpos`. Três estratégias para o mesmo requisito, e no máximo uma delas está certa para o comportamento do Prisma (não confirmei se `contains` já escapa). Se o Prisma já escapa, a busca de cliente com `\` ou `_` falha; se não, a busca de produto trata `%` e `_` como curinga. Também a busca por `variants.some.barcode contains` e `LIKE '%x%'` em nome/código/e-mail não usam índice (sem `pg_trgm`), e `search` com 4+ dígitos em cliente também consulta telefone, mesmo quando o termo é um e-mail ou nome com números.
- Impacto para quem usa o sistema: buscas com `_`/`%` dão resultado inesperado em um dos módulos; listagens lentas em bases grandes.
- Sugestão: padronizar (helper de busca literal compartilhado) e considerar índice trigram.

## [Baixo] Contratos e rotas inconsistentes
- Onde: catalog/infrastructure/http/routes/productVariantsRoutes.ts:14 (`/barcode/:id`, parâmetro chamado `id` mas é o código de barras; GetProductVariantByBarcodeController.ts:8-9); customer/infrastructure/http/routes/customerRoutes.ts:14 (PATCH) vs catalog (PUT parcial em produto, marca, variante); GetCustomerController.ts:15-17 e GetProductVariantByBarcodeController.ts:20-22 (404 no controller; Product/Brand/Category lançam no use case); controllers de variante redefinem `productIdParamsSchema`/`idParamsSchema` localmente embora `productSchemas.ts:26` exporte um
- Problema: verbos diferentes para a mesma semântica de atualização parcial; 404 decidido no controller em dois lugares (regra fora da camada de aplicação); schemas de params duplicados; nomes de parâmetro enganosos. Um código de barras com `/` ou caracteres reservados precisa de encoding na URL.
- Impacto para quem usa o sistema: integrações e front precisam tratar exceções; bugs de rota por confusão de nomes.
- Sugestão: padronizar (PATCH para parcial, ou PUT sempre), mover o 404 para os use cases e usar `GET /variants?barcode=` ou `/variants/by-barcode/:barcode`.

## [Baixo] Tipagem e código morto
- Onde: catalog/application/mappers/ProductVariantReadMapper.ts:4 (`data: any`) e PrismaProductVariantReadRepository.ts:23-25,43-45,54-56 (`include: { product: true }` só para ler `product.id`); catalog/infrastructure/http/factories/CatalogServiceFactory.ts:9-10 (imports comentados); createVariantSchema.ts:17 e ProductVariantDTO.ts:23 (`sku` comentado); ProductVariantDTO.ts:17-18 (`VariantDTO` alias); `CatalogApplicationService` e `CatalogService` (só via factory); PrismaProductRepository.findByCode, PrismaProductVariantRepository.findByCode/delete/findByProduct (verificar usos, `findByProduct` é usado por CatalogWriteApplicationService); Customer.ts:50-64 (`rename/changeEmail/...` nunca chamados, pois `PrismaCustomerRepository.update(id, patch)` grava o patch direto, ignorando a entidade); CustomerHttpPresenter.toHTTP (cópia idêntica do DTO); customer/infrastructure/http/factories/ListCustomerFactory (`makeLisCustomerUseCase`, typo) e `CustomerService.ts` no diretório de factories.
- Problema: `any` na fronteira de leitura e `include` completo do produto; entidade de cliente sem regras e contornada; restos de código.
- Impacto para quem usa o sistema: indireto (manutenção, join desnecessário por variante lida).
- Sugestão: tipar o mapper com `Prisma.ProductVariantGetPayload`, selecionar `productId` direto; remover o morto.

## [Baixo] `handle` público em alguns use cases transacionais
- Onde: catalog/application/useCases/commands/CreateVariantUseCase.ts:27, UpdateVariantUseCase.ts:21; customer CreateCustomerUseCase.ts:25, UpdateCustomerUseCase.ts:16
- Problema: a base declara `protected abstract handle` (TransactionalUseCase.ts:14) e esses use cases o alargam para público. Quem chamar `.handle()` diretamente executa fora de transação (o `NumberGenerator` e o lock dependem de uma). Os demais use cases usam `protected`.
- Impacto para quem usa o sistema: nenhum hoje; risco de uso errado por outro módulo.
- Sugestão: `protected async handle`.

## [Baixo] Testes dependem do banco compartilhado
- Onde: catalog/infrastructure/http/__tests__/*.ts, catalogTestData.ts:1-113, customer/infrastructure/http/__tests__/customers.test.ts:43-46
- Problema: todos os testes usam o banco real configurado (sem isolamento por schema ou transação), com dados `tx-test-*` e limpeza por ids rastreados. Se um teste falhar antes do `track`, sobra lixo; a limpeza apaga por `deleteMany` em várias tabelas. Não encontrei teste de concorrência para unicidade de código de barras nem para edição simultânea. Os testes de exclusão e de nomes de marca cobrem bem o caminho feliz e os 409 (não executei a suíte).
- Impacto para quem usa o sistema: risco de poluir o banco de desenvolvimento e testes flaky em paralelo.
- Sugestão: banco de teste dedicado e teste de corrida para barcode e update.

## Pontos fortes
- Exclusão de produto, variante, marca e categoria usa `FOR UPDATE` em ordem consistente (produto, depois variantes ordenadas por id), com `assertInTransaction` para evitar trava fora de transação, e checa "em uso" por consulta SQL única (`findInUse`) sem N+1.
- Unicidade de marca/categoria sem diferença de caixa garantida por índice `lower(name)` no banco, com tradução do P2002 para 409 amigável e comentário explicando a corrida.
- Listagens paginadas com `ORDER BY` determinístico (`name, id`), count em paralelo e `include` com `select`, sem N+1; produto traz `_count.variants` na mesma consulta.
- Schemas Zod com mensagens em pt-BR, `refine` para PATCH vazio, normalização de strings vazias para `null`, telefone/e-mail normalizados no cliente.
- Regras de variante (nome não vazio, preço não negativo, "última variante") ficam no domínio/use case, e a leitura após escrita de Product/Brand/Category roda na mesma transação com erro de invariante explícito.
- Permissões das rotas coerentes (`read`/`write`/`delete` por verbo) e exclusão restrita a ADMIN; `CatalogWriteService` reusa os use cases, mantendo as mesmas validações para a importação de NF-e.

## Não verificado
- Não executei os testes nem consultei o banco (só leitura de código).
- Se o `contains` do Prisma escapa `%`/`_` (ver achado de busca).
- Comportamento exato do `NumberGenerator` (lacunas na sequência se a transação reverter) e do `HttpResponse`/`parseInput`: infraestrutura compartilhada, fora do escopo.
- Quais outras tabelas/rascunhos de NF-e referenciam `ProductVariant` além das listadas em `findInUse` (só o schema parcial foi lido).
- Mensagem exata do erro de overflow numérico do Prisma para `Decimal(12,2)` (assumido como 500 por não estar mapeado no errorHandler).
- Se o status de `BusinessRuleError` é 422 ou 400 (afeta o caso de nome de variante só com espaços).
- Frontend: uso real de `BARCODE_ALREADY_EXISTS` e dos campos do contrato.

---

## Revisão — backend/src/modules/inventory

Caminhos relativos a `backend/src/modules/inventory/` salvo indicação.

## [Alto] Estoque em caixas nunca é baixado por venda, saída manual, ajuste ou devolução
- Onde: application/useCases/commands/DispatchInventoryUseCase.ts:38-68; AdjustInventoryUseCase.ts:52-67; ReturnSaleStockUseCase.ts:91-119; AddProductToBoxUseCase.ts:62-72. `InventoryBoxStock` só é escrito por AddProductToBox/RegisterScanned (grep: nenhum outro uso em `src/modules`). RemoveProductFromBoxUseCase.ts existe mas não tem factory nem rota.
- Problema: a venda (`InventoryApplicationService.consumeStock` → Dispatch) consome `lot.remainingQuantity` em FIFO, mas não mexe nas alocações por caixa. Depois de uma venda, `sum(boxStock.quantity)` de um lote pode passar de `remainingQuantity`. Em AddProductToBox, `available = max(0, remaining - allocated)` (linha 65) chega a 0 e trava novas alocações. Não existe endpoint para tirar produto da caixa e corrigir isso.
- Impacto para quem usa o sistema: a consulta de caixa (`GET /inventory/boxes/code/:code`, by-lot) mostra peças que já foram vendidas. O conferente procura na caixa um produto que não está lá. Com o tempo não dá mais para alocar o lote em caixa ("Quantidade excede o saldo do lote disponível para caixas (0)"), e a única saída é mexer direto no banco.
- Sugestão: decidir qual caixa cada saída consome (receber `boxId` na saída, ou consumir caixas em ordem fixa) e baixar `InventoryBoxStock` na mesma transação. Ligar RemoveProductFromBox numa rota idempotente. No mínimo, criar um job ou relatório de divergência `allocated > remaining`.

## [Alto] /receive e /dispatch aceitam origem e referência livres e podem travar o cancelamento de vendas
- Onde: interfaces/http/schemas/receiveInventorySchema.ts:22-28; dispatchInventorySchema.ts:11-13; ReturnSaleStockUseCase.ts:40-79
- Problema: a entrada manual aceita qualquer `origin` (SALE, PURCHASE, RETURN…), qualquer `sourceType` (PURCHASE…), `originReferenceId` como texto livre e `notes` sem tamanho máximo. A saída manual aceita `origin: "SALE" | "RETURN"` com qualquer UUID. O ReturnSaleStock usa justamente `findByOrigin(RETURN, saleId)` e `findByOrigin(SALE, saleId)` para decidir a devolução. Dois casos: um IN manual com `origin=RETURN, originReferenceId=<venda>` faz o cancelamento acusar "já devolvido". Um OUT manual com `origin=SALE, originReferenceId=<venda>` faz as saídas não baterem com os itens. Os dois lançam `InternalInvariantError`, que vira 500.
- Impacto para quem usa o sistema: um operador com `inventory.write`, por engano ou de propósito, impede o cancelamento de uma venda real (erro 500 genérico, sem explicação). Ele também cria movimentações que parecem compras ou vendas sem documento de verdade, o que estraga a auditoria do kardex.
- Sugestão: nas rotas manuais, permitir só origens manuais (MANUAL/INVENTORY/TRANSFER) e fixar `sourceType` em MANUAL. Reservar SALE/PURCHASE/RETURN para os serviços internos. Limitar `notes` a 500 caracteres, como nos outros schemas. Validar `originReferenceId` como uuid.

## [Alto] Geração de etiquetas sem limite de quantidade (DoS por memória e CPU)
- Onde: interfaces/http/schemas/generateInventoryBoxLabelSchema.ts:8-13; application/useCases/commands/GenerateInventoryProductLabelsUseCase.ts:23-28; infrastructure/pdf/InventoryLabelPdfService.ts:56-77
- Problema: `quantity` só precisa ser positivo, sem máximo. O use case monta `Array.from({length: quantity})` e o pdfkit desenha todas as páginas de forma síncrona e junta tudo num Buffer. Medi localmente com o pdfkit do projeto: 20.000 etiquetas levaram cerca de 2,3 s com o event loop bloqueado e cerca de 940 MB de RSS. Um valor como 1e8 derruba o processo (OOM) e 1e10 dá RangeError (500). `productCode` também não tem tamanho máximo e não é conferido contra o conteúdo da caixa.
- Impacto para quem usa o sistema: um único clique com um número alto (ou um erro de digitação) congela a API para todos os usuários, ou reinicia o servidor no meio de vendas.
- Sugestão: `.max()` no schema (por exemplo 500) e no use case, `max(100)` em `productCode`. Considerar mandar o PDF em stream (`reply.send(doc)`) em vez de juntar num Buffer.

## [Médio] Ajuste de inventário corta reservas silenciosamente
- Onde: domain/entities/Inventory.ts:135-147; AdjustInventoryUseCase.ts:40-46,81-93
- Problema: `adjust(counted)` faz `reservedQuantity = counted` quando a contagem fica abaixo do reservado. Não grava movimentação RELEASE, não registra qual `originId` perdeu a reserva e o ADJUSTMENT não guarda o reservado anterior.
- Impacto para quem usa o sistema: reservas feitas para pedidos somem sem rastro. Depois, o `/release` daquela reserva falha com "Quantidade reservada insuficiente" e ninguém sabe dizer por quê.
- Sugestão: recusar o ajuste abaixo do reservado (422 pedindo para liberar antes) ou gerar RELEASE explícito com nota. Em qualquer dos casos, guardar o reservado anterior na movimentação.

## [Médio] Reserva e liberação sem vínculo com o documento de origem
- Onde: ReserveInventoryUseCase.ts:41 (`origin ?? SALE`); ReleaseInventoryUseCase.ts:22-34; interfaces/http/schemas/releaseInventorySchema.ts:3-9; ReserveInventoryController.ts:16-22
- Problema: a reserva via HTTP sempre grava `origin=SALE` com qualquer UUID em `originId`, sem checar se a venda existe. A liberação recebe só `inventoryId` e `quantity`, sem `originId`, e grava RELEASE com origem SALE e `originId` nulo. Não dá para saber qual reserva foi liberada, e qualquer usuário pode liberar a reserva de outro documento.
- Impacto para quem usa o sistema: o saldo "reservado" não pode ser reconciliado por pedido, e a liberação de um pedido pode consumir a reserva de outro.
- Sugestão: exigir `originId` (e a origem) na liberação e validar `released <= reservado daquele originId` (soma de RESERVE − RELEASE). Gravar a origem real em vez do default SALE.

## [Médio] Consumo de lotes por data de criação, não por validade (FEFO), e sem desempate
- Onde: infrastructure/prisma/repositories/PrismaInventoryLotRepository.ts:68-86; usado em DispatchInventoryUseCase.ts:38 e AdjustInventoryUseCase.ts:50
- Problema: `orderBy: { createdAt: "asc" }`, sem desempate por `id` e sem considerar `expirationDate`. Lotes já vencidos (`InventoryLot.isExpired` existe, mas não é usado) também são consumidos. Lotes criados no mesmo milissegundo, como numa importação, saem em ordem não determinística.
- Impacto para quem usa o sistema: a venda baixa um lote novo enquanto o lote que vence antes fica na prateleira e expira, gerando perda de produto. Pode também baixar lote vencido sem aviso.
- Sugestão: ordenar por `expirationDate asc nulls last, createdAt asc, id asc` e decidir a política para lotes vencidos (bloquear ou avisar).

## [Médio] Entrada no mesmo número de lote ignora o novo custo e as novas datas
- Onde: ReceiveInventoryUseCase.ts:46-73; domain/entities/InventoryLot.ts:96-103
- Problema: quando já existe um lote com o mesmo `batchNumber` e o mesmo `purchaseItemId` (inclusive o caso `null`, que cobre todas as entradas manuais e de leitura), `lot.receive` soma só a quantidade. O `unitCost`, a `expirationDate` e a `manufacturingDate` da nova entrada são descartados sem aviso, enquanto o custo médio do inventário usa o custo novo.
- Impacto para quem usa o sistema: o custo do lote (exibido em `/variants/:id/lots`, e usado como fallback na devolução, ReturnSaleStockUseCase.ts:112) fica errado. Uma segunda entrada com validade diferente some.
- Sugestão: recusar (409) quando custo ou datas divergem, ou recalcular a média ponderada do `unitCost` do lote. Validar a coerência das datas.

## [Médio] Leitura do assistente de contagem cria um lote por bipe quando não há lote informado
- Onde: RegisterScannedProductUseCase.ts:45-61; ReceiveInventoryUseCase.ts:46-51,74-87
- Problema: sem `batchNumber`, cada `/initial-count` cria um `InventoryLot` novo e uma linha `InventoryBoxStock` nova, com quantidade padrão 1. Contar 500 unidades gera 500 lotes. O `unitCost` padrão também é lido de `findByProductVariantId` antes da trava (linha 59-61), então o custo médio pode já estar desatualizado.
- Impacto para quem usa o sistema: a lista de lotes da variante e a tela da caixa ficam poluídas com centenas de lotes de 1 unidade, a paginação fica lenta e o FIFO perde o sentido.
- Sugestão: sem lote informado, somar num lote MANUAL "aberto" da mesma variante e caixa (ou num lote da sessão de contagem). Ler o custo médio depois da trava.

## [Médio] Listagem de movimentações devolve total sem os filtros
- Onde: infrastructure/prisma/contracts/PrismaStockMovementReadRepository.ts:31-46
- Problema: `getDb().stockMovement.count()` é chamado sem `where`, enquanto o `findMany` aplica filtros por inventário, variante, tipo e origem. Também há `as any` nos filtros (linhas 25 e 29).
- Impacto para quem usa o sistema: no kardex filtrado por produto, a paginação mostra o total de movimentações do sistema inteiro, com páginas vazias e contagem errada.
- Sugestão: `count({ where })` e tipar os filtros com o enum do Prisma ou um mapper.

## [Médio] Tela/consulta de caixa não informa quanto há na caixa
- Onde: application/mappers/InventoryBoxReadMapper.ts:18-30; application/dto/InventoryBoxDTO.ts:10-14
- Problema: `toDTOWithExtends` descarta `stock.quantity` e devolve só `boxId`, `inventoryLot` (com `allocatedQuantity` somado em todas as caixas) e `productVariant`. A quantidade daquele lote naquela caixa não vai na resposta.
- Impacto para quem usa o sistema: ao ler a caixa, o usuário vê o total do lote em todas as caixas, não o que deveria encontrar nesta.
- Sugestão: incluir `quantity` (e `id`) do `InventoryBoxStock` em `InventoryBoxStockItemDTO`. Conferir o consumo no frontend.

## [Médio] Tabela StockMovement sem índices
- Onde: backend/prisma/schema.prisma:227-262 (nenhum `@@index`); migrations não criam índice para StockMovement
- Problema: `findByOrigin(origin, originId)` (chamado em todo cancelamento de venda), a listagem por `productVariantId`/`inventoryId` e `orderBy createdAt` fazem varredura completa numa tabela que só cresce. `InventoryLot.inventoryId` (findAvailableByInventory) também não tem índice.
- Impacto para quem usa o sistema: cancelamento de venda e kardex ficam mais lentos com o tempo. Como o cancelamento roda com linhas travadas, a demora aumenta o risco de `lock_timeout` em vendas simultâneas.
- Sugestão: `@@index([origin, originId])`, `@@index([productVariantId, createdAt])`, `@@index([inventoryId, createdAt])` em StockMovement e `@@index([inventoryId, remainingQuantity])` em InventoryLot, via migração revisada.

## [Baixo] Ajuste para baixo perde o vínculo com os lotes consumidos
- Onde: AdjustInventoryUseCase.ts:48-67,81-93
- Problema: a redução consome vários lotes, mas grava uma única movimentação ADJUSTMENT com `inventoryLotId = null`. A saída de venda grava uma movimentação por lote; o ajuste não.
- Impacto para quem usa o sistema: o histórico do lote não explica por que `remainingQuantity` caiu, e a auditoria por lote fica incompleta.
- Sugestão: uma movimentação por lote tocado, com saldos encadeados, igual ao Dispatch.

## [Baixo] Custo médio sem arredondamento e coluna Decimal sem escala
- Onde: domain/entities/Inventory.ts:88-96; backend/prisma/schema.prisma:215 (`averageCost Decimal` sem `@db.Decimal(p,s)`); PrismaInventoryReadRepository.ts:91 (soma em float)
- Problema: a média ponderada é feita em float JS e gravada com toda a precisão (por exemplo 10.333333333333334). O valor total do estoque no dashboard é somado em float. O mesmo vale para `InventoryLot.unitCost` e `StockMovement.averageCost`.
- Impacto para quem usa o sistema: centavos fantasmas em valor de estoque e relatórios, e divergência entre telas que arredondam em pontos diferentes.
- Sugestão: calcular em centavos ou Decimal, arredondar para 4 casas e definir `@db.Decimal(14,4)`.

## [Baixo] Dashboard de estoque carrega todos os inventários em memória
- Onde: infrastructure/prisma/contracts/PrismaInventoryReadRepository.ts:62-108
- Problema: `findMany` sem limite seguido de agregação em JS.
- Impacto para quem usa o sistema: o dashboard fica mais lento conforme o catálogo cresce.
- Sugestão: um `SELECT SUM/COUNT ... FILTER` só no banco (`$queryRaw`) ou `aggregate`.

## [Baixo] Content-Disposition montado com texto do usuário
- Onde: infrastructure/http/controllers/GenerateInventoryProductLabelsController.ts:25-28; GenerateInventoryBoxLabelController.ts:16
- Problema: `productCode` e `code` vão crus para `filename="..."`. Aspas quebram o header e caracteres fora de latin1 (emoji) fazem o Node lançar `ERR_INVALID_CHAR`, que vira 500.
- Impacto para quem usa o sistema: erro 500 ou nome de arquivo estranho ao imprimir etiqueta de produto com código incomum.
- Sugestão: sanitizar (`[^A-Za-z0-9_-]` → `_`) e usar `filename*=UTF-8''...`.

## [Baixo] Busca de caixas por lote fixa página 1 com 10 itens
- Onde: application/useCases/queries/GetInventoryBoxByLotAndProductVariantIdUseCase.ts:9-14
- Problema: paginação fixa. Um lote espalhado em mais de 10 caixas nunca mostra as demais, embora a resposta seja "paginada" com o `total` correto.
- Impacto para quem usa o sistema: caixas "somem" na busca por lote.
- Sugestão: aceitar `page`/`limit` na query.

## [Baixo] Criação de caixa sem idempotência
- Onde: infrastructure/http/routes/inventoryBoxRoutes.ts:25-29
- Problema: `POST /inventory/boxes` não usa `idempotent()`, ao contrário das outras escritas, e cada chamada consome um número da sequência.
- Impacto para quem usa o sistema: um duplo clique ou retry de rede cria duas caixas e pula códigos.
- Sugestão: envolver com `idempotent(...)`.

## [Baixo] Código morto e superfície de auditoria mutável
- Onde: rotas comentadas em infrastructure/http/routes/inventoryRoutes.ts:4-5,15-16,95-116; inventoryBoxRoutes.ts:4-8,16-17,55-79; inventoryLotRoutes.ts:3-9,19-48; stockMovementRoutes.ts:4-11,22-43; application/dto/InventoryBalanceDTO.ts (arquivo vazio); RemoveProductFromBoxUseCase.ts (sem uso); domain/repositories/InventoryBoxStockRepository.ts:10-18 (comentado); PrismaStockMovementRepository.ts:32-54 (`update`/`delete` de movimentação disponíveis, sem uso); `findByProductVariantId` sem limite e sem uso (linhas 51-61).
- Problema: os comentários referenciam controllers que não existem (RemoveInventoryController, CreateStockMovementController…). O kardex, que deveria ser só de inserção, expõe update e delete no contrato.
- Impacto para quem usa o sistema: nenhum direto. Aumenta o risco de alguém reativar uma rota antiga ou apagar uma movimentação.
- Sugestão: remover os comentários e o DTO vazio. Tirar `update`/`delete` de `IStockMovementRepository`. Ligar ou apagar RemoveProductFromBox.

## [Baixo] Mappers de leitura tipados como `any`
- Onde: application/mappers/StockMovementReadMapper.ts:7; InventoryLotReadMapper.ts:10; InventoryBoxReadMapper.ts:9,19; InventoryBoxStockReadMapper.ts:6,16
- Problema: `toDTO(data: any)`, então mudanças no schema ou no `include` não quebram a compilação (o próprio InventoryLotReadMapper precisa checar `boxStocks` em tempo de execução). O DTO de movimentação também não expõe `previousQuantity`, `currentQuantity`, `averageCost` nem `inventoryLotId`, que são gravados.
- Impacto para quem usa o sistema: risco de campo `undefined` na resposta sem aviso, e kardex sem saldo anterior e atual visível.
- Sugestão: tipar com `Prisma.XGetPayload<{include: ...}>` e expor os saldos no DTO.

## [Baixo] Testes de integração usam o banco de desenvolvimento e deixam lacunas
- Onde: infrastructure/http/__tests__/inventoryHttp.test.ts, infrastructure/prisma/__tests__/*.test.ts, application/useCases/__tests__/concurrency.test.ts (importam `@shared/prisma`, que usa `DATABASE_URL` do `.env` → banco `inventory`); src/test/inventoryFixtures.ts
- Problema: os testes gravam e limpam dados no mesmo banco do desenvolvimento (a limpeza é por ids próprios, mas uma falha no meio deixa resíduo). Não há teste para: limite e conteúdo das etiquetas PDF, `total` da listagem de movimentações com filtro, consistência caixa × lote após venda, e ajuste abaixo do reservado. Os 59 testes unitários de domínio e aplicação passam (rodados nesta revisão).
- Impacto para quem usa o sistema: regressões nos pontos acima passam sem ser vistas, e os testes podem afetar ou ser afetados pelos dados locais.
- Sugestão: usar um `DATABASE_URL` de teste separado e adicionar os casos citados.

## Pontos fortes
- Trava de linha consistente: toda escrita de saldo e de lote passa por `lockByProductVariantId`/`lockExistingByProductVariantId` (`SELECT ... FOR UPDATE`, com assert de transação ativa) antes de ler saldo e lotes. Venda, cancelamento e compra travam as variantes em ordem crescente, o que evita deadlock.
- Upsert do inventário com `INSERT ... ON CONFLICT DO NOTHING` seguido de `FOR UPDATE` elimina a corrida de criação concorrente.
- Validação de saldo antes de qualquer gravação, e invariantes de domínio fortes (reservado ≤ quantidade, restante ≤ inicial, coerência previous/current por tipo de movimentação).
- A devolução de venda restaura exatamente os lotes de origem, confere o total com os itens da venda e grava RETURN com saldos encadeados e `userId`.
- Rotas de escrita protegidas por permissão e quase todas idempotentes. Schemas Zod com limites de paginação e tratamento explícito de datas nulas ou vazias (`requestDate`).
- `userId` do token propagado para todas as movimentações, com teste HTTP cobrindo isso.

## Não verificado
- Uso no frontend da resposta da caixa (se depende de `quantity` por caixa) e de `/inventory/product-variant/barcode/:barcode`, que devolve a variante, não o estoque.
- Comportamento real de `lock_timeout` e deadlock sob carga. Não rodei os testes de integração com banco (concurrency, inventoryLock, repositories, inventoryHttp).
- Se outros módulos (nfe-import, catalog delete) escrevem em lotes ou caixas sem passar pela trava de inventário (só olhei sales e purchases).
- O tratamento central de erros e o idempotent() em si (infra compartilhada, fora do escopo).

---

## Revisão 04 — Backend: vendas, financeiro (receber/pagar), dashboard, relatórios CSV

## [Alto] Lista e exportação de contas a receber/pagar carregam o histórico inteiro na memória a cada requisição
- Onde: backend/src/modules/finance/infrastructure/prisma/contracts/PrismaFinancialDocumentReadRepository.ts:184-235 (loadEntries), :148-178 (list), :237-252 (listParcelsForExport)
- Problema: `loadEntries` faz `financialDocument.findMany` só com `type` (+ filtros opcionais) e traz TODOS os documentos do tipo com todas as parcelas e todos os pagamentos. Status de exibição, `openOnly`, ordenação, resumo e paginação (`entries.slice`) são feitos em JS. Sem filtro, a tela padrão de /receivables carrega documentos pagos e cancelados de todo o histórico só para mostrar 20 linhas. Na exportação CSV, o limite de 50.000 linhas (`ExportTooLargeError`, linha 252) só é checado depois que tudo já foi carregado e mapeado. O comentário da classe (:139-146) reconhece que isso só serve para volumes pequenos.
- Impacto para quem usa o sistema: o tempo de resposta e o uso de memória crescem com cada venda ou compra já registrada, porque nada sai do conjunto, nem o que já foi pago. Com alguns milhares de títulos, abrir Contas a Receber/Pagar e exportar o CSV fica lento. Várias abas ou usuários ao mesmo tempo podem estourar a memória do processo.
- Sugestão: levar a regra para SQL (CTE por parcela com `remaining = amount − Σ pagamentos ativos`, `displayStatus` e `nextDueDate` calculados no banco). Fazer `ORDER BY` + `LIMIT/OFFSET` e o resumo com `SUM … FILTER` no banco. A consulta agregada do dashboard (PrismaDashboardReadRepository.ts:139-156) já tem a regra pronta. Na exportação, contar antes ou usar `LIMIT maxRows+1` no SQL.

## [Médio] FinancialDocument não tem nenhum índice: busca por origem, contraparte e tipo vira varredura completa
- Onde: backend/prisma/schema.prisma:341-357 (model FinancialDocument sem `@@index`); usos: sales/infrastructure/prisma/contracts/PrismaSaleReadRepository.ts:48-64 (`findFirst` por type/originType/originId), finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository.ts:50-54 (`lockByOrigin` … FOR UPDATE), PrismaFinancialDocumentReadRepository.ts:185-187 (`type`, `partyId`, `status`)
- Problema: a migração `20261023120000_dashboard_indexes` criou índices em FinancialParcel, Payment, Sale e SaleItem, mas nenhum em FinancialDocument. Também não há unicidade por `(type, originType, originId)`. Isso faz `GET /sales/:id`, a resposta de `POST /sales` e de `POST /sales/:id/cancel`, o cancelamento de pedido e o filtro por cliente/fornecedor varrerem a tabela inteira.
- Impacto para quem usa o sistema: o detalhe da venda e o cancelamento ficam mais lentos conforme os títulos se acumulam. No cancelamento, a varredura acontece dentro da transação que já travou a venda, o que prolonga as travas.
- Sugestão: `@@index([type, originType, originId])` (de preferência `@@unique`, porque o código já assume um documento por origem na leitura) e `@@index([type, partyId])` / `@@index([type, status])`, numa migração criada com o fluxo seguro do projeto.

## [Médio] Resumo da lista (A vencer / Vencido / Recebido) ignora o intervalo de vencimento
- Onde: backend/src/modules/finance/infrastructure/prisma/contracts/PrismaFinancialDocumentReadRepository.ts:156-161; FinancialDocumentReadMapper.ts:87-110 (`figures`)
- Problema: com `dueFrom/dueTo`, o filtro escolhe os documentos que têm alguma parcela no intervalo (:188-197), mas o resumo soma `figures.notDueCents/overdueCents/paidCents` de TODAS as parcelas desses documentos. A exportação CSV, com os mesmos filtros, recorta por parcela (:245-251). Exemplo: um título 3x com parcelas em jan/fev/mar, filtrado só por fevereiro, entra no resumo com as três parcelas. Nenhum teste cobre resumo com intervalo (receivablesRead.test.ts:217-229 e openOnly.test.ts:135-141 não passam `dueFrom/dueTo`).
- Impacto para quem usa o sistema: quem filtra "vencimentos desta semana" vê no cartão de resumo valores maiores que a soma das parcelas da semana, e o número não bate com o CSV exportado com o mesmo filtro.
- Sugestão: com intervalo, somar no resumo só as parcelas dentro do intervalo (a mesma regra `keep` da exportação). Ou deixar explícito na UI que o resumo é por documento inteiro. Incluir um teste.

## [Médio] CSV "itens vendidos": a coluna "Produto" mostra o nome da variante e a coluna "Variante" mostra o nome atual do cadastro
- Onde: backend/src/modules/reports/infrastructure/prisma/PrismaReportReadRepository.ts:70; sales/infrastructure/prisma/mappers/SaleItemMapper.ts:26 (`productName: item.variantName`); CreateSaleUseCase.ts:65 (`variantName: variant.name`, nome da variante)
- Problema: `SaleItem.productName` guarda o snapshot do nome da VARIANTE (ProductVariantDTO.name). O relatório usa `si."productName"` como "Produto" e `v."name"` (nome atual, sem snapshot) como "Variante". Resultado: o nome do produto nunca aparece, a mesma informação sai duas vezes e, se a variante for renomeada, as duas colunas divergem e o histórico deixa de ser fiel. O teste (reports.test.ts:76) grava `productName` direto via Prisma e por isso não percebe o problema.
- Impacto para quem usa o sistema: a planilha de itens vendidos não permite agrupar por produto, e vendas antigas aparecem com o nome novo da variante.
- Sugestão: buscar `p."name"` (JOIN Product) para a coluna "Produto" e usar o snapshot `si."productName"` na coluna "Variante". A longo prazo, renomear a coluna para `variantName` e gravar também o snapshot do nome do produto.

## [Médio] Dashboard: o bloco financeiro agrega a tabela Payment inteira a cada carregamento
- Onde: backend/src/modules/dashboard/infrastructure/prisma/contracts/PrismaDashboardReadRepository.ts:146-156
- Problema: a subconsulta `SELECT "parcelId", SUM(amount) FROM "Payment" WHERE "reversedAt" IS NULL GROUP BY "parcelId"` não é restrita ao tipo nem aos documentos abertos. O filtro `fd.type/fd.status <> 'CANCELED'` não tem índice (ver item anterior), então a consulta lê todas as parcelas e todos os pagamentos já registrados. Ela roda duas vezes por request (receber e pagar) e o dashboard é a página inicial.
- Impacto para quem usa o sistema: a tela inicial fica mais lenta com o tempo, mesmo que haja pouco em aberto.
- Sugestão: usar um `LEFT JOIN LATERAL`/subconsulta correlacionada por parcela (aproveita `Payment_parcelId_idx`), restringir a documentos `status IN ('OPEN','PARTIALLY_PAID')` (PAID tem restante 0 e não muda o resultado) e indexar `FinancialDocument(type, status)`.

## [Baixo] Venda sem limite de itens: transação longa com N+1 consultas segurando travas de estoque
- Onde: backend/src/modules/sales/interfaces/http/schemas/createSaleSchema.ts:38-40 (`.min(1)` sem `.max`); CreateSaleUseCase.ts:53-72 e :94-101
- Problema: cada item gera uma leitura de variante e uma baixa de estoque (com trava), em sequência, dentro de uma única transação. Só o bodyLimit (1 MB) limita o tamanho, o que permite milhares de itens.
- Impacto para quem usa o sistema: uma venda muito grande (ou um payload malicioso de um usuário autenticado) segura as travas das variantes por muito tempo e as outras vendas recebem timeout de trava.
- Sugestão: `.max(…)` no array (ex.: 200) e buscar as variantes em lote (`findMany`).

## [Baixo] Total da venda pode ultrapassar Decimal(12,2) e virar 500
- Onde: backend/prisma/schema.prisma:272 (`totalAmount Decimal(12,2)`); createSaleSchema.ts:17-20 (quantidade sem máximo); Sale.ts:29
- Problema: não há teto para a quantidade nem para o total. Um total ≥ R$ 10.000.000.000,00 (possível com estoque alto e preço alto) estoura a coluna no `sale.create` e gera erro do Prisma (500), em vez de um 422 com mensagem.
- Impacto para quem usa o sistema: um erro genérico difícil de entender, num caso extremo.
- Sugestão: validar no domínio `totalAmountCents <= 999_999_999_999` com BusinessRuleError, e colocar um teto razoável na quantidade.

## [Baixo] Detalhe da venda mostra só o primeiro documento a receber, enquanto o cancelamento trata vários
- Onde: backend/src/modules/sales/infrastructure/prisma/contracts/PrismaSaleReadRepository.ts:48-64 (`findFirst … orderBy createdAt`); finance/application/useCases/commands/cancelOriginDocuments.ts:6 ("não há unicidade por origem")
- Problema: as duas pontas assumem coisas diferentes, e o banco não garante nenhuma delas (falta unicidade, ver item de índices).
- Impacto para quem usa o sistema: se um dia surgir um segundo título para a mesma venda (script, importação), ele não aparece na tela da venda.
- Sugestão: criar `@@unique([type, originType, originId])` e simplificar os dois lados para um documento por origem.

## [Baixo] Listagem de vendas e relatório por período não aproveitam o índice de data
- Onde: backend/src/modules/sales/infrastructure/prisma/contracts/PrismaSaleReadRepository.ts:22 (`orderBy createdAt desc` + OFFSET); reports/infrastructure/prisma/PrismaReportReadRepository.ts:42-44 e :60-61 (período sem status); schema.prisma:284 (só `@@index([status, createdAt])`)
- Problema: o índice composto começa por `status`. Consultas sem igualdade de status (lista de vendas, CSV sem status, dashboard com `status <> 'CANCELED'`) acabam ordenando ou varrendo a tabela Sale.
- Impacto para quem usa o sistema: a lista e os relatórios de vendas ficam mais lentos conforme a base cresce.
- Sugestão: adicionar `@@index([createdAt])` (ou `(createdAt, id)` para a ordenação da lista).

## [Baixo] Contrato do FinancialService mistura reais (float) e centavos
- Onde: backend/src/modules/finance/application/services/FinacialService.ts:1-18; FinancialApplicationService.ts:28; sales/application/useCases/commands/CreateSaleUseCase.ts:109
- Problema: a venda converte centavos para reais (`fromCents`) e o serviço converte de volta (`toCents`). O pedido de compra já passa centavos. A ida e volta não perde valor hoje (toCents é robusto), mas é uma fonte de erro e foge da regra "centavos em todo cálculo" (money.ts:1). O nome do arquivo também tem um erro de digitação (`FinacialService`).
- Impacto para quem usa o sistema: nenhum imediato. É risco de regressão em manutenção futura.
- Sugestão: `parcels: { amountCents; dueDate }[]` também em `createSaleReceivable` e renomear o arquivo.

## [Baixo] Status de venda PENDING sem uso e default do banco diferente do domínio
- Onde: backend/prisma/schema.prisma:103-107 e :276 (`@default(PENDING)`); Sale.ts:30 (domínio cria COMPLETED); reportControllers.ts:29,53 (aceita/rotula "Pendente")
- Problema: nenhum fluxo cria venda PENDING, mas o filtro e o rótulo do CSV oferecem a opção. Uma inserção que não passe pelo domínio nasce PENDING.
- Impacto para quem usa o sistema: a opção de filtro "Pendente" sempre retorna vazio.
- Sugestão: trocar o default para COMPLETED ou remover PENDING. Não expor esse status no filtro enquanto não existir.

## [Baixo] Vendedor pode cancelar qualquer venda, de qualquer vendedor
- Onde: backend/src/shared/auth/permissions.ts:39 (`sales.cancel` para VENDEDOR); sales/application/useCases/commands/CancelSaleUseCase.ts:26-41 (sem checagem de dono nem de prazo)
- Problema: o cancelamento devolve estoque e cancela o financeiro, sem restrição de autoria ou de prazo. Pode ser uma decisão de negócio (a matriz foi aprovada), mas vale confirmar.
- Impacto para quem usa o sistema: um vendedor pode desfazer vendas de colegas (e afetar comissão e indicadores) sem aprovação.
- Sugestão: confirmar a regra. Se for o caso, restringir ao `sellerId` do token ou a ADMIN, ou exigir motivo e auditoria.

## [Baixo] Testes do dashboard aceitam quase qualquer valor financeiro por compartilharem o banco
- Onde: backend/src/modules/dashboard/infrastructure/http/__tests__/dashboard.test.ts:243-244 (`assert.ok(a.open - b.open >= …)`), também :282 e :329-330
- Problema: como outras suítes gravam no mesmo banco em paralelo, as asserções de `open`/`overdue`/`purchases` usam `>=`. Um bug que conte a mais (por exemplo, incluir documentos cancelados ou pagamentos estornados) passa. Os documentos são fabricados direto via Prisma, sem passar pelos casos de uso.
- Impacto para quem usa o sistema: regressões de valor no dashboard podem chegar à produção sem quebrar a CI.
- Sugestão: isolar por tipo e janela (por exemplo, filtrar por partyId de teste numa função do repositório) ou rodar essas suítes em série, com asserção exata de delta.

## Pontos fortes
- Dinheiro em centavos inteiros no domínio (`toCents` robusto a float, `buildInstallments` com o resto na última parcela e soma exata). Somas SQL em `numeric` com `::text`.
- Concorrência bem pensada e testada: venda trava as variantes em ordem crescente, a devolução de estoque também ordena (ReturnSaleStockUseCase.ts:61), cancelamento trava venda → documentos (ORDER BY id) → estoque, pagamento e estorno travam o documento e releem sob a trava. Há testes de cancelamento duplo, pagamento × cancelamento e pagamentos que somados excedem o saldo.
- Regra de status centralizada (`receivableStatus.ts`) e reaproveitada por entidade, lista, detalhe, detalhe da venda e exportação, com data de negócio America/Sao_Paulo. O dashboard e os relatórios convertem `timestamp` UTC para BRT corretamente, com limites de período sargáveis.
- Isolamento por `FinancialType` em todas as leituras e escritas (outro tipo → 404 sem gravar), com permissões separadas para receber e pagar e dashboard por seção conforme a permissão.
- CSV com BOM, `;`, CRLF, escape de aspas e neutralização de fórmula em todo texto livre. Limite de linhas e de período (366 dias) nos relatórios de venda via `LIMIT n+1`.
- Validação de entrada sólida (datas reais, no máximo 2 casas decimais, pagamento futuro e anterior à criação do título bloqueados, variante duplicada rejeitada).

## Não verificado
- Implementação compartilhada de idempotência (`idempotent`), `parseInput`, `authorize`, paginação e `PrismaTransactionManager`: só verifiquei como estes módulos os usam.
- Internals de `DispatchInventoryUseCase` (baixa de estoque e respeito a `reservedQuantity`) e se toda variante tem linha em `Inventory` (afeta "sem estoque" no dashboard).
- Planos de execução reais (EXPLAIN) e volumes de produção: as conclusões de desempenho vêm da leitura do código e do schema.
- Não rodei as suítes HTTP/integração (gravam no banco compartilhado). Rodei só os testes puros de domínio de finance e o SaleReadMapper (13/13 passando).
- Frontend: só conferi os rótulos "Em aberto"/"A vencer" para checar a semântica do resumo.

---

## Auditoria backend: purchases + nfe-import

Caminhos relativos a `backend/src/modules/`.

## [Alto] Confirmação de NF-e pode estourar colunas do banco (Int / Decimal(12,2)) e responder 500
- Onde: nfe-import/application/useCases/commands/ConfirmNfeImportUseCase.ts:107-108,139-157; nfe-import/domain/nfePurchaseLines.ts:30-35; nfe-import/infrastructure/prisma/PrismaNfeImportRepository.ts:377; infrastructure/parser/NfeParser.ts:68-80,82-89; prisma/schema.prisma (PurchaseItem.quantity Int, Decimal(12,2), NfeImport.totalAmount Decimal(12,2))
- Problema: o parser só exige "inteiro seguro" (2^53) para dinheiro e quantidade, e `unitsPerPackage` aceita até 100.000. Em `nfeItemUnits`, units = qCom × unitsPerPackage não tem teto. O fluxo manual limita quantidade (1e6) e total (MAX_AMOUNT_CENTS) no Zod (purchaseSchemas.ts:421-423,489), mas o fluxo da NF-e não aplica nenhum limite equivalente. Quantidade acima de 2^31-1 (por exemplo qCom 30.000 × 100.000 unidades por embalagem) ou valor acima de 9.999.999.999,99 vai direto ao Prisma e vira erro de banco (500). No upload o mesmo vale para `totalAmount` (vNF grande) em `contentOf`.
- Impacto para quem usa o sistema: uma nota com valores absurdos (ou um `unitsPerPackage` digitado errado) falha com "erro interno" sem dizer qual item está errado. Para o upload malformado a transação é revertida, mas o usuário não entende o que houve.
- Sugestão: validar no parser (vNF e itens ≤ 999.999.999.999 centavos) e em `nfeItemUnits`/`toPurchaseLines` (units ≤ 1.000.000 como no manual), com 422 INVALID_NFE / NFE_QUANTITY_NOT_INTEGER e mensagem "Item n: ...".

## [Médio] Tolerância de centavos no vNF gera 422 INSTALLMENTS_TOTAL_MISMATCH sem saída clara
- Onde: nfe-import/infrastructure/parser/NfeParser.ts:199-200 (tolerância de `composing.length` centavos); ConfirmNfeImportUseCase.ts:153-157,223-233; purchases/application/services/PurchaseCreator.ts:78-85
- Problema: o parser aceita nota cuja soma dos itens difere do vNF em até 1 centavo por item. O pedido é criado com a soma dos itens (`costTotal`), nunca com o vNF. As duplicatas da nota (`cobr/dup`) somam o vNF, e a conferência exata em `PurchaseCreator.save` as recusa se houver diferença de 1 centavo ou mais. O mesmo ocorre quando as duplicatas somam menos que o vNF (entrada paga à vista, situação comum).
- Impacto para quem usa o sistema: uma nota válida não confirma com as parcelas da própria nota, e o usuário precisa redigitar as parcelas. O contas a pagar também pode ficar alguns centavos diferente do boleto/vNF.
- Sugestão: documentar e devolver, em `GET /nfe-imports/:id`, `totals.total` e a diferença contra o pedido. Alternativa: ajustar a última parcela para a diferença (≤ tolerância) ou devolver 422 com os dois valores. O front deve exibir a divergência antes do confirm.

## [Médio] Item de NF-e duplicado em nItem não é rejeitado; units/lotes ficam trocados
- Onde: nfe-import/infrastructure/parser/NfeParser.ts:261-262,244 (index vem de `@_nItem`, sem checar unicidade); ConfirmNfeImportUseCase.ts:107-109,120 (`Map` por `item.index`)
- Problema: dois `<det nItem="1">` são aceitos. `matchItems` associa as duas linhas à mesma requisição e `units` é um `Map` por index, então as unidades do segundo item sobrescrevem as do primeiro. `resolved` usa `units.get(item.index)` para ambos: o custo soma dos dois itens, mas as unidades (estoque e preço unitário) vêm só de um.
- Impacto para quem usa o sistema: estoque e custo unitário errados, sem erro, para uma nota malformada. É raro, mas silencioso e envolve dinheiro.
- Sugestão: no parser, rejeitar nItem repetido, não inteiro ou ausente (INVALID_NFE) em vez de cair no fallback `position + 1`; ou chavear o Map por posição.

## [Médio] Lotes da nota são descartados silenciosamente (validade perdida) em colisão de número de lote
- Onde: nfe-import/domain/nfeLotNumbers.ts:262-266 (`deliveryBatchNumber` retorna undefined); ConfirmNfeImportUseCase.ts:244-250; nfePurchaseLines.ts:37-45 (lotes sem número ou com qLote 0 ignorados)
- Problema: quando "nLote" e "nLote-PCxxxx" já existem na variante, a entrada vai sem lote, sem nenhum aviso. Os datas de fabricação e validade da nota também são perdidas. O mesmo ocorre com `rastro` sem nLote. As datas dFab/dVal do `rastro` também não passam por nenhuma validação (validade < fabricação é aceita), ao contrário do recebimento manual (purchaseSchemas.ts:591).
- Impacto para quem usa o sistema: produto perecível entra no estoque sem validade, e FEFO/alertas de vencimento deixam de enxergá-lo.
- Sugestão: gerar um sufixo sequencial único em vez de cair no "sem lote", ou avisar na resposta quais lotes foram renomeados/descartados. Validar dVal ≥ dFab no parser.

## [Médio] Duas linhas da nota com o mesmo supplierCode sobrescrevem o mapeamento aprendido
- Onde: ConfirmNfeImportUseCase.ts:122-133; nfe-import/infrastructure/prisma/PrismaSupplierProductMappingRepository.ts:5-14
- Problema: o mapeamento é único por (supplierId, supplierCode). Se a nota repete o cProd (ou ele vem vazio, pois `supplierCode` default é ""), cada item faz upsert com sua variante/unitsPerPackage e a última vence. Um cProd vazio vira mapeamento "" → uma variante qualquer.
- Impacto para quem usa o sistema: nas próximas notas do fornecedor, a sugestão automática vincula o item à variante errada (e a conversão de embalagem errada), e o usuário pode aceitar sem perceber.
- Sugestão: não gravar mapeamento para supplierCode vazio e, quando houver conflito dentro da mesma nota, gravar apenas se todos os itens com o código apontarem para a mesma variante/unitsPerPackage.

## [Médio] Nota confirmada com recebimento não tem como ser desfeita; reimportação fica bloqueada
- Onde: purchases/domain/entities/Purchase.ts:123-130 (cancel recusa qualquer recebimento); nfe-import/application/useCases/commands/UploadNfeImportUseCase.ts:337-340; ConfirmNfeImportUseCase.ts:160
- Problema: `receive: true` recebe tudo na hora. Depois disso o pedido não pode mais ser cancelado (PURCHASE_HAS_RECEIPTS) e a chave só volta a ser importável se o pedido for cancelado (409 NFE_ALREADY_IMPORTED). Não existe fluxo de estorno de recebimento neste módulo. Um erro de vínculo (variante errada, unitsPerPackage errado) fica permanente.
- Impacto para quem usa o sistema: erro de conferência na tela de confirmação vira estoque e custo errados e definitivos, corrigíveis só por ajuste manual de estoque (e o contas a pagar continua vivo).
- Sugestão: oferecer estorno de recebimento (ou cancelamento com baixa de estoque quando os lotes ainda estão intactos), ou ao menos avisar na tela de confirmação com `receive: true` que a operação é irreversível.

## [Médio] NF-e não-compra (devolução/complementar/ajuste, nota de saída, cancelada) é importada como compra
- Onde: nfe-import/infrastructure/parser/NfeParser.ts:167-200
- Problema: o parser só exige modelo 55 e valida chave e totais. Não olha `ide/finNFe` (2 = complementar, 3 = ajuste, 4 = devolução), `ide/tpNF`, o CNPJ do destinatário (`dest`) contra a empresa, nem a situação de autorização (`protNFe/infProt/cStat`, eventos de cancelamento).
- Impacto para quem usa o sistema: uma NF-e de devolução ou complementar, ou emitida contra outro destinatário, vira pedido de compra, contas a pagar e estoque. Uma nota cancelada na SEFAZ também é aceita.
- Sugestão: rejeitar finNFe ≠ 1 (ou tratá-las à parte), conferir `dest` contra o CNPJ da empresa configurado e, se `protNFe` existir, exigir cStat 100/150. Se a regra deve ser flexível, ao menos devolver aviso no DTO do rascunho.

## [Baixo] NF-e 100% bonificação / total zero não pode ser importada
- Onde: purchases/domain/entities/Purchase.ts:90 (PURCHASE_TOTAL_ZERO); NfeParser.ts:200
- Problema: nota com vNF = 0 (bonificação/amostra) passa no parser e em `toPurchaseLines`, mas `Purchase.create` recusa total ≤ 0 (422). O `purchaseCreator.save` também exige parcelas somando exatamente o total.
- Impacto para quem usa o sistema: mercadoria recebida em bonificação não entra pelo XML e a entrada precisa ser feita à mão, sem custo zero rastreável.
- Sugestão: aceitar total 0 quando origem for XML (sem contas a pagar) ou devolver mensagem NFE_ZERO_TOTAL dedicada em vez de erro genérico de pedido.

## [Baixo] Data de emissão convertida para o fuso do negócio, não a data declarada na nota
- Onde: NfeParser.ts:250-259 (`businessDateOfInstant`); shared/domain/businessDate.ts:27-36
- Problema: `dhEmi` com offset diferente do fuso do negócio (-04:00 do Amazonas ou -02:00 de Noronha, ou emitente em horário de verão) pode produzir uma data diferente da que consta no DANFE. Também `dVenc` ausente ou inválido vira `issueDate` silenciosamente (NfeParser.ts:203).
- Impacto para quem usa o sistema: data da compra/vencimento um dia diferente do documento em casos de borda; um vencimento ausente vira "vence na emissão".
- Sugestão: usar a data local declarada no `dhEmi` (primeiros 10 caracteres, já validados) e não inventar vencimento: marcar parcela sem dVenc como inválida e exigir confirmação.

## [Baixo] Decodificação assume UTF-8 e ignora a declaração `encoding` do XML
- Onde: NfeParser.ts:220-228
- Problema: o buffer é lido sempre como UTF-8. XML com `encoding="ISO-8859-1"` (existe em emissores antigos) gera caracteres corrompidos nos nomes (xNome/xProd), sem erro. UTF-16 é recusado por conter byte 0 (bom, evita DOCTYPE oculto).
- Impacto para quem usa o sistema: nomes de fornecedor/produto com "�" gravados no `payload` e no cadastro sugerido.
- Sugestão: ler o `encoding` da declaração e decodificar com `TextDecoder` (aceitando só utf-8 e iso-8859-1/windows-1252); recusar o resto.

## [Baixo] Criação sequencial de variantes/consultas dentro de transação de 30 s (N+1)
- Onde: purchases/application/services/PurchaseCreator.ts:61-65; ConfirmNfeImportUseCase.ts:116-121,273; PrismaNfeLotLookup.ts
- Problema: `getProductVariant` por item, `resolveVariant` por item, e consulta de lotes por linha, em série, numa transação com timeout de 30 s e `lockTimeoutMs` de 15 s (NfeImportFactories.ts:124). Com a faixa de numeração `PURCHASE` travada durante todo o processo (`numberGenerator.generate` em `build`), uma nota grande segura a criação de qualquer outro pedido até terminar.
- Impacto para quem usa o sistema: confirmação de notas de centenas de itens fica lenta e pode estourar o prazo; criação de pedidos manuais pode esperar.
- Sugestão: buscar variantes em lote (`findMany in`), e gerar o código do pedido o mais tarde possível dentro da transação.

## [Baixo] Custo unitário arredondado: Σ(qtd × custo) difere do total do item
- Onde: purchases/domain/entities/PurchaseItem.ts:230-232; purchases/infrastructure/prisma/mappers/PurchaseMapper.ts:80
- Problema: `unitCost = round-half-up(total/quantity)` é usado como custo do estoque (ReceivePurchaseUseCase.ts:80). Total 100 com quantidade 3 vira custo 0,33 e 0,99 de valor em estoque. O resíduo existe no estoque e não no contas a pagar (o contas a pagar usa totais exatos, então fica consistente).
- Impacto para quem usa o sistema: valor do estoque e CMV divergem em centavos por item/lote, acumulando em compras de muitas unidades.
- Sugestão: documentar a política (já está no comentário) ou guardar o custo com mais casas decimais (Decimal(14,6)).

## [Baixo] Corrida entre exclusão de fornecedor e pedido: dependência de FK sem tratamento explícito
- Onde: purchases/application/useCases/commands/DeleteSupplierUseCase.ts:10-14,24; PrismaSupplierRepository.ts:409-411; ConfirmNfeImportUseCase.ts:187-193
- Problema: `ConfirmNfeImportUseCase`/`PurchaseCreator.build` leem o fornecedor sem `FOR UPDATE`/`FOR SHARE`. Se a exclusão confirmar entre a leitura e o INSERT do pedido, o erro de FK (P2003) não é mapeado e sobe como 500. O comentário em DeleteSupplierUseCase diz "falha na FK", mas ninguém converte isso em 404/409.
- Impacto para quem usa o sistema: janela estreita, mas o resultado é "erro interno" no meio de uma confirmação longa que foi revertida.
- Sugestão: mapear P2003 de `supplierId` para supplierNotFound no `PrismaPurchaseRepository.create`, ou travar o fornecedor com FOR SHARE em `build`.

## [Baixo] Código morto e valores de enum sem uso
- Onde: purchases/domain/enums/PurchaseOrigin.ts:4-5 (IMPORT e REPLENISHMENT sem uso no código); prisma/schema.prisma:31-36
- Problema: só MANUAL e XML são usados em `backend/src` (verificado por busca). Os repositórios e erros do domínio de compras estão todos em uso (conferido por busca dos exports de `purchaseErrors`, `supplierErrors` e `nfeImportErrors`: nenhum export sem referência).
- Impacto para quem usa o sistema: nenhum direto; confunde quem lê o schema e filtros de API (`origin`).
- Sugestão: remover os valores não usados numa migração (ou documentar que são reservados).

## [Baixo] Testes de integração acoplados a fixtures do frontend e ao banco compartilhado
- Onde: purchases/infrastructure/http/__tests__/purchases.test.ts:15-18 (lê JSON de `frontend/src/test/fixtures/purchases/`); purchases/application/useCases/commands/__tests__/CancelPurchase.test.ts e nfe-import/application/useCases/commands/__tests__/UploadNfeImportUseCase.test.ts (usam mocks parciais com `as unknown as`)
- Problema: o teste de backend depende de um diretório do frontend (se o front mudar o fixture, o backend quebra sem relação com a lógica). Todos os testes HTTP criam dados reais com marcadores aleatórios e limpam em `after`; isolamento depende de unicidade de CPF/CNPJ/chaves aleatórias, e uma falha antes do cleanup deixa lixo no banco de dev. As faixas de numeração (`PC######`) são globais.
- Impacto para quem usa o sistema: nenhum direto; afeta confiança e estabilidade da suíte.
- Sugestão: mover os fixtures de contrato para um lugar neutro (ex. `shared/contracts`), e usar banco de teste dedicado.

## Pontos fortes
- Dinheiro em centavos inteiros do início ao fim: o parser lê o texto sem float (`cents`/`quantityToScaled`) e `toPurchaseLines` distribui o resíduo de arredondamento em desconto/imposto com invariante que lança erro se total do item ≠ custo da nota.
- Segurança de XML: DTD/ENTITY rejeitados antes do parse, `processEntities: false` com decodificação própria só de entidades predefinidas, bytes NUL/UTF-16 recusados, limite de 10 MB com `truncated` tratado no controller.
- Transação única na confirmação (rascunho, fornecedor, catálogo, mapeamentos, pedido, contas a pagar, estoque e CONFIRMED), com `FOR UPDATE` no rascunho, descarte e upload serializados e ordem de trava documentada (pedido → variantes em ordem crescente).
- Prevenção de duplicidade bem pensada: unicidade por chave de acesso com retry no upload concorrente, `createOrGetByDocument` com `ON CONFLICT DO NOTHING`, upsert atômico de mapeamento por SQL.
- Documentos CPF/CNPJ (inclusive CNPJ alfanumérico) validados com DV e normalizados de forma consistente no parser, nos schemas e na busca.
- Cobertura de testes de parser com fixtures reais (indTot, desoneração, IPI devolvido, CNPJ alfanumérico, DOCTYPE) e erros de domínio mapeados (sem 500 nos caminhos de negócio comuns).

## Não verificado
- Comportamento de `InventoryService.receivePurchaseStock` e `FinancialService.createPurchasePayable` (módulos de terceiros): unicidade de lote sob confirmações concorrentes da mesma variante e tratamento de P2002/BATCH_ALREADY_EXISTS fora da lookup não travada.
- `SequentialNumberGenerator` (trava da faixa de numeração) e `idempotent()` / `TransactionalUseCase`: reviewed por outro revisor.
- Rodar a suíte de testes (exige banco): não executada.
- Comportamento do `fast-xml-parser` com aninhamento muito profundo e 10 MB (consumo de CPU/stack): não medido; a chamada `XMLValidator.validate` é síncrona e bloqueia o event loop durante a validação.
- Frontend e mapeamento das mensagens "Item n:" para a linha da tela.

---

## Revisão 06 — Frontend transversal (shared / auth / routes / test infra)

Verificações executadas: `npx tsc -b` (limpo), `npx eslint .` (limpo), `npx vite build` (ver bundle abaixo).

## [Alto] Bundle único de ~989 kB (286 kB gzip) sem code-splitting
- Onde: frontend/src/routes/routes.ts:2-14 e frontend/src/routes/AppRoutes.tsx:62-95 (imports estáticos de todos os módulos; nenhum `lazy`/`Suspense` em src/)
- Problema: `vite build` gera um único `index-*.js` de 988,87 kB e o próprio Vite avisa que passa de 500 kB. Login, dashboard, NF-e, scanner (html5-qrcode), gráficos etc. são baixados juntos.
- Impacto para quem usa o sistema: primeira carga lenta em rede móvel/Wi-Fi de depósito, inclusive só para ver a tela de login.
- Sugestão: `React.lazy` por rota (ou por módulo) com `Suspense` dentro do `DashboardLayout`; carregar `html5-qrcode` sob demanda; opcionalmente `manualChunks` para vendor.

## [Médio] Token JWT em localStorage e logout não sincronizado entre abas
- Onde: frontend/src/shared/store/auth.ts:24,36,45; frontend/src/shared/services/api.ts:60
- Problema: o token fica em `localStorage` (legível por qualquer XSS) e o store lê o token só na carga. Não há listener de `storage`: logout/expiração em uma aba não derruba as outras (estado zustand e cache do React Query permanecem; só as requisições seguintes falham com 401). O interceptor lê `localStorage` direto em vez do store, então os dois podem divergir. `setSession`/`logout` chamam `localStorage.*` sem try/catch (só `readToken` protege), lançando em modo privado/storage bloqueado e impedindo o login.
- Impacto para quem usa o sistema: em PC compartilhado, outra aba continua mostrando dados da sessão anterior após logout; em navegadores com storage bloqueado o login falha sem mensagem clara.
- Sugestão: assinar `window.addEventListener('storage')` para sincronizar logout; usar `useAuthStore.getState().token` no interceptor; envolver escritas em try/catch; avaliar cookie httpOnly + CSRF se o backend permitir (mitigar XSS com CSP).

## [Médio] ConfirmDialog sem gerenciamento de foco, Escape e trava de scroll
- Onde: frontend/src/shared/components/ConfirmDialog.tsx:200-217
- Problema: ao contrário de `Modal` (Modal.tsx:35-86 tem trap de Tab, restauração de foco e Escape), o diálogo de confirmação destrutiva não move o foco para dentro, não fecha com Escape, não restaura o foco e não impede Tab de sair para a página atrás. Também não tem `aria-describedby`, e o texto "Excluindo..." (linha 278) é fixo mesmo quando `confirmText` é outra ação.
- Impacto para quem usa o sistema: usuários de teclado/leitor de tela podem confirmar exclusões sem perceber o diálogo ou ficar com foco "perdido" atrás do overlay; rótulo errado em ações que não são exclusão.
- Sugestão: reutilizar `Modal` (ou extrair o hook de foco) e parametrizar o texto de loading.

## [Médio] Modal: ids fixos, Escape em modais empilhados e Escape durante envio
- Onde: frontend/src/shared/components/Modal/Modal.tsx:88-104,142,150,156
- Problema: `id="modal-title"`/`"modal-description"` são fixos; com dois modais abertos (ex.: modal + ConfirmDialog/outro Modal) há ids duplicados e `aria-labelledby` ambíguo. Todos os modais abertos registram listener `keydown` no `document`, então um Escape fecha todos de uma vez (não só o do topo). O Escape e o clique no overlay fecham mesmo com submit em andamento (não há prop de "busy"), perdendo o formulário enquanto a mutação segue em voo.
- Impacto para quem usa o sistema: fechar sem querer um formulário longo (venda/compra) no meio do envio; leitores de tela anunciam título errado.
- Sugestão: `useId()` para os ids; pilha de modais (só o topo reage a Escape); prop `dismissible`/`busy` para bloquear fechamento durante submit.

## [Médio] Falha transitória em /users/me na recarga manda o usuário ao login sem limpar o token
- Onde: frontend/src/shared/hooks/useAuth.ts:19-37
- Problema: `retry: false` e `isRestoring = !!token && !user && !isError`. Se `/users/me` falhar por rede ou 5xx (não 401), `isError` vira true, `user` segue null → `isAuthenticated` false → RouteGuard envia para `/login` com o token ainda no storage. Na tela de login (guard `public`) o usuário não está "autenticado", então vê o formulário mesmo com sessão válida, sem aviso de erro.
- Impacto para quem usa o sistema: um soluço de rede/servidor na abertura do app parece "deslogou"; precisa digitar a senha de novo (ou recarregar).
- Sugestão: distinguir erro de rede/5xx (tela "não foi possível conectar, tentar de novo" com retry) de 401 (logout); permitir 1–2 retries no `/users/me`.

## [Médio] Sem tratamento global de 403 (permissão revogada/papel alterado)
- Onde: frontend/src/shared/services/api.ts:69-83; frontend/src/routes/RouteGuard.tsx:130; frontend/src/shared/auth/permissions.ts:42-92
- Problema: o interceptor só trata 401. A matriz `ROLE_PERMISSIONS` é um espelho manual do backend (comentário em permissions.ts:41); a revalidação do papel só ocorre quando `["auth","me"]` refaz o fetch (staleTime padrão 0, só em mount/foco). Se o papel mudar ou a matriz divergir, a UI mostra ações que retornam 403 e cada tela exibe o erro à sua maneira (toast genérico via handleMutationError). Não há teste que compare as duas matrizes.
- Impacto para quem usa o sistema: botões que "não funcionam" com mensagem pouco clara; drift silencioso entre front e back quando uma permissão for adicionada.
- Sugestão: no interceptor, em 403 com código de permissão, invalidar `["auth","me"]`; criar teste de contrato que importe/compare a matriz do backend (ou expor `/users/me` com a lista de permissões e usá-la no front).

## [Médio] Limpeza de cache no login/troca de sessão depende de convenção
- Onde: frontend/src/shared/store/auth.ts:18,35-38; frontend/src/modules/auth/pages/Login.tsx:200
- Problema: `logout` documenta "Callers must also clear the query cache" — dois chamadores (useLogout.ts:93-96 e api.ts:77-78) o fazem, mas `setSession` (login) não limpa o cache. Qualquer caminho futuro que chame `store.logout()` sozinho deixa dados do usuário anterior. Além disso, mutações em voo no momento do logout/401 não são canceladas (`queryClient.clear()` não cancela `mutationCache` em andamento) e suas `onSuccess`/toasts rodam depois.
- Impacto para quem usa o sistema: risco de ver dados em cache de outro usuário/papel após troca de conta; toasts de sucesso de operação anterior aparecendo na tela de login.
- Sugestão: mover `queryClient.clear()` (e `cancelQueries`) para dentro de uma única função `endSession` usada por todos; limpar também em `setSession`.

## [Baixo] Chave `["auth","me"]` fora de `queryKeys` e checagem de permissão duplicada
- Onde: frontend/src/shared/hooks/useAuth.ts:20; frontend/src/shared/react-query/keys.ts:3
- Problema: a única chave literal fora do registro central; `useAuth` roda uma `useQuery` por componente que o chama (AppRoutes, RouteGuard x N, Sidebar), deduplicadas, mas cada um reexecuta o `useEffect` de `setUser`.
- Impacto: manutenção/consistência (invalidações por chave centralizada não a encontram).
- Sugestão: adicionar `queryKeys.me` e usá-la.

## [Baixo] Dependências não usadas / de ferramenta em `dependencies`
- Onde: frontend/package.json (dependencies)
- Problema: `class-variance-authority`, `radix-ui`, `tw-animate-css` não têm nenhum import em src/ (grep); `shadcn` (CLI, ^4) é dependência de runtime só referenciada por components.json; `autoprefixer`/`postcss`/`prettier` estão ok em devDependencies mas `prettier` sem config verificada. `projesctStructure` (typo) é script de `tree`. Tailwind 3 enquanto o resto é muito novo (vite 8, React 19) — risco de migração futura.
- Impacto: superfície de supply-chain e tempo de install maiores sem benefício.
- Sugestão: remover as não usadas (confirmar `src/components/ui/*` antes — `button.tsx` pode usar cva/radix: verificar), mover `shadcn` para devDependencies, renomear/remover o script.

## [Baixo] Acessibilidade de formulários: erros sem `aria-invalid`/`aria-describedby`
- Onde: frontend/src/modules/auth/components/ChangePasswordModal.tsx:47-77 (só `currentPassword` tem describedby; `newPassword` não tem id no erro nem aria); Login.tsx (erro em `role="alert"` ok, mas campos sem aria-invalid)
- Problema: leitores de tela não associam a mensagem ao campo; inconsistência entre campos do mesmo formulário.
- Sugestão: padronizar via componente de campo/`form.tsx` com `aria-invalid` + `aria-describedby`.

## [Baixo] Guard de teste de Idempotency-Key lança no `afterEach` e usa lista fechada de rotas
- Onde: frontend/src/test/setup.ts:133-166
- Problema: (1) a lista `COVERED_POSTS` é manual: um novo endpoint monetário/estoque passa despercebido (falso sentido de cobertura); (2) lança erro em `afterEach` — falhas aparecem atribuídas ao teste errado/hook e podem ser mascaradas se o teste já falhou; (3) `configure({ asyncUtilTimeout: 4000 })` e `testTimeout: 20000` (vite.config.ts:16) mascaram lentidão em vez de corrigi-la e podem esconder regressões de performance; (4) `server.events.on` é registrado no import, sem `removeAllListeners` em `afterAll`.
- Impacto: manutenção de testes; regressão de idempotência em rota nova não detectada.
- Sugestão: derivar a lista de um teste de contrato com o backend (rotas com `idempotent` middleware) ou inverter a regra (todo POST exige chave, com allowlist de exceções como /auth/login e /users); usar `expect.hasAssertions`/falhar dentro do handler.

## [Baixo] `ExportButton`/`downloadFile`: erro só inline e dependente de `Content-Disposition` exposto
- Onde: frontend/src/shared/components/export/ExportButton.tsx:36-43; frontend/src/shared/utils/download.ts:14-30
- Problema: tratamento coerente (erro mostrado uma vez), mas 401 durante download mostra "Sessão expirada"? — o interceptor já redireciona; o erro inline ainda é setado no componente desmontado/prestes a desmontar (setState após unmount sem efeito, só ruído). Não há aviso quando o CSV é truncado por limite do backend.
- Sugestão: ignorar `status === 401` como em `handleMutationError` (utils/mutation.ts:107).

## [Baixo] `ForbiddenPage` vs rota inexistente e fallback `*` sem página 404
- Onde: frontend/src/routes/AppRoutes.tsx:96
- Problema: qualquer URL desconhecida redireciona silenciosamente para `/` ou `/login` — sem 404; rota privada acessada deslogado perde o destino (não há `returnTo` no Navigate de RouteGuard.tsx:128).
- Impacto: links compartilhados/favoritos caem no dashboard após login em vez do destino.
- Sugestão: guardar `location` em `state`/`?next=` e redirecionar após login; página 404 para autenticados.

## Pontos fortes
- Interceptor 401 bem pensado: ignora `/auth/login`, só marca "expirado" se havia token, limpa store e query cache sem reload (api.ts:69-83), com teste dedicado.
- `parseApiError` robusto: normaliza qualquer valor lançado, lê corpo Blob, primeiro erro por campo, `details` opcional (parseApiError.ts).
- Idempotência bem modelada: `IdempotencyKeyTracker` mantém a chave entre retries com as mesmas variáveis, renova em sucesso/`IDEMPOTENCY_KEY_REUSED`, e há guarda de teste global para POSTs críticos.
- Política de retry sensata (sem retry em 4xx, até 3 em rede/5xx) com teste; `useCrudMutation` centraliza toast de sucesso/erro e evita toast duplo via `silentError`.
- `Modal` base tem trap de foco, restauração de foco e bloqueio de scroll; `RouteGuard` + `Can`/`useCan` usam `Object.hasOwn` para evitar papéis prototype-poisoned; `tsc` e `eslint` limpos, sem `any`/`@ts-ignore` fora de testes.

## Não verificado
- Se o backend aceita/valida token por cookie httpOnly (afeta sugestão de armazenamento) e se revoga tokens ao trocar/resetar senha.
- Conteúdo de `src/components/ui/*` (para confirmar se cva/radix-ui estão realmente sem uso) e do `Sidebar`/`BarcodeScanner` (liberação de câmera ao desmontar, rótulos aria).
- `SalesChart`, `UserFormModal`, `ResetPasswordModal` e `DataTable`/`Autocomplete` em profundidade (a11y de combobox, re-renders).
- Execução da suíte de testes (flakiness real) e auditoria `npm audit` de vulnerabilidades/versões desatualizadas.
- Paridade exata da matriz de permissões com backend/src/shared/auth/permissions.ts.

---

## Revisão 07 — Frontend: products, brands, categories, customers, inventory

Caminhos abaixo relativos a `frontend/src/modules/`.

## [Alto] Edição de variante usa cache velho e pode reverter preço/nome em silêncio
- Onde: products/hooks/useVariant.ts:7 (chave `["variant", id]`), products/hooks/useUpdateVariant.ts:11-15, products/pages/VariantEditPage.tsx:13,39-43, products/components/VariantForm.tsx:49-51
- Problema: `useUpdateVariant` invalida apenas `products`, `product(id)` e `variants(id)`; a chave `["variant", id]` nunca é invalidada. Ao reabrir a edição dentro do gcTime, o cache antigo (pré-edição) aparece com `isLoading=false`, e o `useForm` usa `defaultValues` apenas na primeira montagem, então o refetch em background não atualiza o formulário. No modo edição `salePrice` é obrigatório e é reenviado, logo o PUT grava de volta os valores antigos.
- Impacto para quem usa o sistema: o usuário altera o preço de 10 para 12 e salva. Se reabrir a edição para mudar só o nome, vê preço 10 e, ao salvar, o preço volta a 10 sem aviso. Isso gera preço de venda errado.
- Sugestão: invalidar/atualizar `["variant", variantId]` em `useUpdateVariant`/`useDeleteVariant` (centralizar em `productQueryKeys.variant`); no form de edição usar `values`/`reset` quando os dados chegarem, ou `staleTime: 0` com `refetchOnMount: "always"` e espera do refetch antes de renderizar.

## [Alto] Erros de backend nos campos telefone e endereço do cliente não aparecem em lugar nenhum
- Onde: customers/components/CustomerForm.tsx:34 (FIELDS inclui phone/address), 54-59, 116-155 (só `name` e `email` renderizam `errors.*`)
- Problema: `applySubmitError` marca erro em `phone`/`address` e retorna `true`; como nenhum JSX exibe `errors.phone`/`errors.address`, o `root.server` não é definido (o ramo `!applySubmitError` não roda) e a mutação é `silentError` (useCreateCustomer.ts:15, useUpdateCustomer.ts:17), então também não há toast.
- Impacto para quem usa o sistema: ao salvar com telefone/endereço inválido, o botão "volta ao normal" e nada acontece. O usuário não sabe o que corrigir.
- Sugestão: renderizar `errors.phone` e `errors.address` (com `aria-invalid`/`aria-describedby`) ou passar só campos renderizados em `FIELDS` para que o restante caia no `root.server`. Adicionar teste de erro de campo em phone.

## [Médio] Formulários de cliente, produto e variante sem estado de envio: clique duplo cria duplicados
- Onde: customers/components/CustomerForm.tsx:36 (`loading` nunca é passado: CustomerListPage.tsx:134, CustomerEditModal.tsx:30); products/components/ProductForm.tsx:142-147; products/components/VariantForm.tsx:213-218; inventory/components/ProductVariantRegistration.tsx (esse tem `loading`, mas POST sem Idempotency-Key)
- Problema: nenhum botão de submit é desabilitado durante a requisição (não usam `formState.isSubmitting`) e os hooks (`useCreateCustomer`, `useCreateProduct`, `useCreateVariant`) não usam `idempotent`.
- Impacto para quem usa o sistema: duplo clique em "Cadastrar cliente"/"Salvar Produto" gera dois cadastros ou um erro de duplicidade confuso; em rede lenta não há feedback de que está salvando.
- Sugestão: `disabled={isSubmitting}` + texto "Salvando…" nos três forms; usar `idempotent: true` nas criações se o backend suportar.

## [Médio] Assistente: "Voltar" ou troca de caixa durante "Adicionar à caixa" perde o resultado de uma operação já efetuada
- Onde: inventory/hooks/useInitialInventoryFlow.ts:322-351 (descarta com `isCurrent`), 293-297 e 299-303 (`handleBackToLot`/`handleSelectBox` chamam `nextToken()`); inventory/components/InitialInventoryBoxStep.tsx:331 (botão Voltar não é desabilitado com `loading`)
- Problema: a requisição `addLot` continua no servidor, mas o token invalida o resultado: `placement` não é registrado, o passo não avança e nenhuma mensagem aparece. O teste "Voltar durante adicionar à caixa mantém o passo do lote" (InitialInventoryPage.test.tsx:507) consagra esse comportamento. O mesmo ocorre em `closeModal` durante criação de lote (linha 207): o lote é criado, mas o assistente não o seleciona.
- Impacto para quem usa o sistema: o operador acha que a unidade não foi para a caixa, repete a operação e o estoque em caixas fica duplicado (ou o backend recusa por falta de saldo, sem explicação). Lote criado "some" do fluxo.
- Sugestão: desabilitar Voltar/cancelar/fechar modal enquanto `loading`; ou, quando um resultado de sucesso chegar com token velho, ao menos exibir toast/`placement` e invalidar consultas.

## [Médio] Etiquetas: `window.open` após `await` pode ser bloqueado e o assistente conclui mesmo assim
- Onde: inventory/hooks/useGenerateInventoryProductLabels.ts:183-195; inventory/hooks/useInitialInventoryFlow.ts:388-397
- Problema: o PDF é aberto em nova aba depois da resposta assíncrona (fora do gesto do usuário), sujeito a bloqueio de pop-up; o retorno é `ok: true` mesmo se `window.open` devolver `null`, e então `handleFinishUnit` reseta o fluxo. A `objectURL` nunca é revogada (vazamento). Se o usuário clicar "Voltar" durante a geração, o PDF ainda abre (a abertura ocorre antes da checagem do token).
- Impacto para quem usa o sistema: com pop-up bloqueado nenhuma etiqueta aparece, o fluxo volta ao início e a unidade fica sem etiqueta, sem aviso.
- Sugestão: checar retorno de `window.open`; se nulo, mostrar link "Abrir etiquetas" / baixar via `<a download>`; revogar a URL após uso; só finalizar o fluxo após abrir com sucesso. Não há teste para este hook.

## [Médio] Busca de produtos do assistente sem proteção contra respostas fora de ordem
- Onde: inventory/hooks/useSearchProducts.ts:27-50; inventory/components/InitialInventoryProductSelection.tsx:397-404
- Problema: `searchProducts` grava `setProducts` de qualquer resposta que chegue, sem token/AbortSignal (o restante do fluxo tem `requestToken`, este não). O efeito também dispara a busca vazia ao montar. Usa `useState` manual em vez de React Query (perde cache e cancelamento) e deixa `console.error`.
- Impacto para quem usa o sistema: ao digitar rápido, a lista pode mostrar resultados de um termo anterior e o operador escolhe o produto errado para cadastrar variante.
- Sugestão: migrar para `useQuery` com chave `[products,'wizard-search',debounced]` e `placeholderData`, ou ignorar respostas velhas.

## [Médio] Lista de estoque sem estados de carregando/erro/vazio, coluna "Status" falsa e ação sem gate de permissão
- Onde: inventory/pages/InventoryListPage.tsx:171-216 (só `data`), 191-194 (`Link` "Novo" fora de `<Can>`); inventory/hooks/useInventoryColumns.tsx:438-443 (coluna "Status" renderiza `availableQuantity`), 420-424 (id `phone` para "Produto / Variante")
- Problema: se a API falhar, a tela mostra tabela vazia e "Items (0)" como se não houvesse estoque; não há busca nem indicação de estoque abaixo de `minimumStock` (campo existe em types.ts:93). A coluna "Status" repete o número de "Disponível". "Novo" leva a `/products/new` (exige `catalog.write`) para quem tem só `inventory.read`. O título "Items" está em inglês.
- Impacto para quem usa o sistema: erro de rede é confundido com estoque zerado; o "Status" não informa nada; usuários sem permissão veem botão que leva a bloqueio.
- Sugestão: tratar `isLoading/isError/empty` como em ProductListPage; derivar Status de `availableQuantity` vs `minimumStock` (Sem estoque/Baixo/OK); envolver "Novo" em `<Can permission="catalog.write">`; adicionar busca.

## [Médio] Formulário de lote: erro duplicado e custo unitário padrão 0
- Onde: inventory/components/InventoryLotForm.tsx:41 (`unitCost: ... ?? 0`), 174 (`submitError` sem `role="alert"`), 45-53; inventory/hooks/useInitialInventoryFlow.ts:273-276
- Problema: em erro de validação do backend o fluxo seta `lotError` (mensagem genérica mostrada no banner) e também devolve `fieldErrors` (inline), então o mesmo erro aparece duas vezes; erros não mapeados aparecem em `root.server` e de novo no banner. O custo já vem preenchido com 0, e o backend aceita 0 (`nonnegative`), então esquecer o campo cria lote com custo zero e distorce `averageCost`. Também não há validação de 2 casas decimais em `unitCost` nem de validade anterior à fabricação.
- Impacto para quem usa o sistema: mensagens repetidas confundem; custo médio do estoque pode ficar errado por lote cadastrado sem custo.
- Sugestão: não exibir o banner quando houver `fieldErrors`; começar `unitCost` vazio com `required`; validar casas decimais e coerência de datas.

## [Médio] Dropdowns de marca/categoria e listas de lotes/variantes truncadas em 100 sem aviso
- Onde: brands/hooks/useBrands.ts:7-13, categories/hooks/useCategories.ts:7-13 (usados em products/pages/ProductCreatePage.tsx:13-14, ProductListPage.tsx:40-41, inventory/components/InitialInventoryNewProduct.tsx:21-22); inventory/hooks/useInitialInventoryFlow.ts:83 e inventory/pages/InventoryDetailsPage.tsx:234 (`limit: 100` de lotes, paginação ignorada); inventory/hooks/useProductVariantOptions.ts:5-8
- Problema: só as 100 primeiras opções são carregadas. A tela de edição compensa com `withCurrent` (ProductEditPage.tsx:16), mas criação e filtros não; `useBrands(search)` tem parâmetro de busca que ninguém usa. A tela de detalhes do estoque mostra "N lotes cadastrados" (total real) mas lista no máximo 100. Falhas de brands/categories na criação são silenciosas (`= []`), deixando o select vazio sem erro.
- Impacto para quem usa o sistema: a partir da 101ª marca/categoria não é possível cadastrar produto com ela nem filtrar por ela; lotes além de 100 não aparecem.
- Sugestão: combobox com busca server-side (`search` já suportado) ou paginação; mostrar erro/retry quando a consulta falhar.

## [Médio] Detalhe do produto: falha na lista de variantes não é tratada e cards são placeholders
- Onde: products/pages/ProductDetailsPage.tsx:47-51 (sem `isError` nem loading de variantes), 169-179 (cards "Estoque atual" e "Movimentações" fixos em `--`), 59-65 (mensagens soltas sem `Page`/link de volta)
- Problema: se `/products/:id/variants` falhar a tabela fica vazia, igual a "sem variantes", e o título mostra "Variantes (0)". Os dois cards exibem `--` permanentemente. Em Variant edit/create e Product edit os estados de erro/carregando são `<div>` sem estilo nem link de volta.
- Impacto para quem usa o sistema: erro de rede é lido como produto sem variantes; cards sem função poluem a tela.
- Sugestão: tratar `isError`/`isLoading` da lista de variantes; remover os cards ou ligá-los ao estoque (soma de `useVariantInventory`).

## [Médio] Coluna de estoque faz uma requisição por linha de variante
- Onde: products/components/VariantStock.tsx:8, products/components/ProductVariantColumns.tsx:53, inventory/hooks/useVariantInventory.ts:7-9
- Problema: cada linha (até 10 por página) dispara `GET /inventory/variants/:id`; 404 é tratado como "sem estoque" (bom), mas há N+1 e o erro mostra texto vermelho sem retry. `VariantStock` ainda usa o `loading` com `...` sem acessibilidade.
- Impacto para quem usa o sistema: abertura lenta do produto em rede ruim, e picos de chamadas no backend.
- Sugestão: incluir `availableQuantity` no payload de variantes ou endpoint em lote.

## [Médio] Variante criada no assistente sem preço e fora do serviço compartilhado
- Onde: inventory/components/ProductVariantRegistration.tsx:297-300, 310
- Problema: o POST é feito direto com `api.post` (duplica `variantService.createVariant`), sem `salePrice` (backend assume 0 conforme comentário em VariantForm.tsx:11), sem form/RHF (erros de campo como código de barras duplicado viram só toast), sem Idempotency-Key e sem invalidar `["inventory"]`/`products`.
- Impacto para quem usa o sistema: variantes nascem com preço 0 e só são percebidas na venda; o contador de variantes do produto na lista fica desatualizado até recarregar.
- Sugestão: reutilizar `useCreateVariant` e pedir o preço (ou avisar que ficará 0); invalidar `products`.

## [Baixo] Acessibilidade: labels sem `htmlFor`, botões de ícone sem nome
- Onde: products/components/VariantForm.tsx:96,114 (labels de Nome/Código de barras sem `htmlFor`/`id`), 138 e inventory/components/InitialInventoryScanner.tsx:22 (emoji no botão); inventory/components/ProductVariantRegistration.tsx:328,335 e InitialInventoryScanner.tsx:16 (labels órfãs); products/components/ProductVariantColumns.tsx:63-71,74-82 (links/botões de editar/excluir sem `aria-label`); customers/pages/CustomerDetailsPage.tsx (ok)
- Problema: leitores de tela não associam os rótulos aos campos e leem apenas "botão"/"link" nos ícones. Erros de campo não têm `aria-invalid`/`aria-describedby` em nenhum form do escopo. O botão de editar variante também aparece sem `<Can permission="catalog.write">` (a rota é protegida, o botão não).
- Impacto para quem usa o sistema: usuários de tecnologia assistiva não conseguem preencher/identificar ações; usuários somente-leitura veem editar.
- Sugestão: `htmlFor`/`id`, `aria-label` com nome da variante, `<Can>` no link de edição.

## [Baixo] ProductForm sem validação no cliente e com h1 vazio no modal do assistente
- Onde: products/components/ProductForm.tsx:66-70,95-99,114-118 (sem `required`, `maxLength`); inventory/components/InitialInventoryNewProduct.tsx:19 (`title=""` gera `<h1>` vazio dentro do modal)
- Problema: nome (mín. 3, máx. 120), descrição (máx. 500) e marca/categoria só são validados pelo backend (productSchemas.ts), exigindo ida e volta ao servidor.
- Impacto para quem usa o sistema: feedback lento e `h1` vazio na árvore de acessibilidade.
- Sugestão: `required`/`minLength`/`maxLength` equivalentes e ocultar o cabeçalho quando `title` vazio.

## [Baixo] Detalhe do cliente mostra o UUID em vez do código; formulário com validação nativa duplicada
- Onde: customers/pages/CustomerDetailsPage.tsx:~61 (`Cliente #{customer.id}`); customers/components/CustomerForm.tsx:94-105 (`type="email"` sem `noValidate`)
- Problema: `ICustomer.code` existe e a lista o usa, mas o detalhe exibe o id interno. O `type="email"` faz o navegador bloquear o envio com mensagem própria antes do `validate` em português.
- Impacto para quem usa o sistema: identificador ilegível/inconsistente; mensagens de erro em dois idiomas/estilos.
- Sugestão: exibir `customer.code`; `noValidate` no form.

## [Baixo] Estado `loading` compartilhado em hooks de mutação do estoque
- Onde: inventory/hooks/useInventoryBox.ts:239-271 (um `loading` para `createBox` e `addLot`), inventory/hooks/useProductByBarcode.ts:318-346
- Problema: `setLoading(false)` no `finally` de uma chamada antiga zera o indicador de outra ainda em andamento (duas leituras de código rápidas); `createBox` não usa Idempotency-Key (hoje protegido só por botão desabilitado).
- Impacto para quem usa o sistema: "Consultando produto..." some antes da resposta mais recente; risco residual de caixa duplicada em retentativa.
- Sugestão: contador de requisições em andamento ou `useMutation`; chave de idempotência em `createBox`.

## [Baixo] Cache de inventário não é atualizado quando a variante muda
- Onde: products/hooks/useUpdateVariant.ts:11-15, products/hooks/useDeleteVariant.ts:12-16
- Problema: o inventário embute `productVariant.name/code/barcode` (inventory/types.ts:81-98), mas editar/excluir variante não invalida `queryKeys.inventory`/`inventoryByVariant`.
- Impacto para quem usa o sistema: a lista de estoque mostra nome/código antigo até recarregar.
- Sugestão: incluir `queryKeys.inventory` nas `invalidateKeys`.

## [Baixo] Código morto, duplicado e tipagem frouxa
- Onde:
  - customers/config/routes.tsx:3-10,25-48 e customers/hooks/useCustomerColumns.tsx:9-12,15-20,32,56-69,84-86: blocos comentados copiados de produtos (rotas de produto, coluna de variantes, botão de excluir).
  - inventory/hooks/useInventoryColumns.tsx:3-4,10,15-19,23-25,45-62 (comentários); inventory/pages/InventoryListPage.tsx:17-24,34-40 (CrudHeader comentado, `{' '}` solto).
  - inventory/hooks/useInitialInventoryFlow.ts:112-113, 348-349, 357-358, 364-365: `setLabelError(null)` duplicado; `handleNewLotSuccess`/`handleVariantChosen`/`handleProductSelected`/`handleNewProductSuccess` são wrappers redundantes (linhas 196-202, 224-226).
  - inventory/components/InitialInventoryBoxStep.tsx:16-26 duplica `useDebouncedValue` que já existe em `@/shared/hooks/useDebouncedValue`; inventory/pages/InventoryDetailsPage.tsx:378-380 duplica `formatCurrency` de `@/shared/utils/money`.
  - Sem uso: `createInventory` (inventoryService.ts:39), `getBrand`/`getCategory`, `productMessages.stock`, `customerMessages.deleted`, aliases "legacy" em inventory/types.ts:123-127, `Product`/`ProductVariant` duplicados em inventory/types.ts:129-147 e re-export confuso inventory/types/InitialInventoryTypes.ts:1 (arquivo `types.ts` e pasta `types/` lado a lado).
  - products/services/variantService.ts:16-18,25-27,35-37: `data.data ?? data` com `data` implícito `any` esconde divergência de envelope; ao contrário de productService/brandService, que tipam `{ data: T }`.
  - useCustomers/useCustomer/useCustomerSearch/useProduct/useVariant usam chaves literais em vez de `queryKeys` (ex.: customers/hooks/useCustomers.ts:6, products/hooks/useProduct.ts:7, products/hooks/useVariant.ts:7), o que contribuiu para o bug de invalidação acima.
- Impacto para quem usa o sistema: nenhum direto; aumenta o risco de regressões e dificulta a manutenção.
- Sugestão: remover o que não é usado e centralizar chaves em `queryKeys`.

## [Baixo] Testes que verificam pouco
- Onde: inventory/pages/__tests__/InventoryListPage.test.tsx:10-20 (só checa ausência de "undefined"); customers/components/__tests__/CustomerForm.test.tsx (1 caso, só o campo email); brands/categories/__tests__ (delegam tudo a `namedEntityScenarios`, sem asserts próprios); products/components/__tests__/ProductForm.test.tsx (apenas erros do backend)
- Problema: não há teste para telefone/endereço (bug Alto acima), máscara de telefone, `diffCustomer`, edição de cliente, duplo envio, geração de etiquetas/`window.open`, estados de erro da lista de estoque, nem para reedição de variante com cache.
- Impacto para quem usa o sistema: os defeitos acima passam despercebidos na CI.
- Sugestão: adicionar os cenários citados; um teste de `diffCustomer` (puro) é barato.

## Pontos fortes
- Máquina de estados do assistente com `requestToken` "latest-wins" e testes de corrida (leituras fora de ordem, Voltar durante consulta, fechar modal) em InitialInventoryPage.test.tsx.
- Contratos bem alinhados ao backend: envelopes `{data}`/`{data,pagination}`, `salePrice`/`unitCost` em reais com validação de 2 casas na variante, nulos tratados (`barcode`, `batchNumber`, `email`, `phone`).
- Operações de estoque (lote e item de caixa) com Idempotency-Key reaproveitada entre retentativas (useCreateInventoryLot.ts:140, useInventoryBox.ts:261).
- Lista de produtos completa: debounce, filtros, paginação com ajuste de página ao excluir o último item, `ConfirmDialog` antes de excluir, `<Can>` em editar/excluir e tratamento de 409 pelo backend (useDeleteProduct).
- `diffCustomer` e edição parcial (PATCH) evitam sobrescrever campos não alterados; `withCurrent` em ProductEditPage preserva marca/categoria fora das 100 primeiras.
- Mensagens e erros de campo do backend mapeados via `applySubmitError`, com teste para campo conhecido e desconhecido.

## Não verificado
- Componentes compartilhados (`NamedEntityPage`, `Modal`, `ConfirmDialog`, `DataTable`, `Can`, `useIdempotencyKey`, `parseApiError`): só o uso por estes módulos foi analisado; o foco de teclado/trap do `Modal` e o comportamento real das telas de marcas/categorias (delegadas a `NamedEntityPage`) não foram auditados.
- Se o backend honra `Idempotency-Key` em `POST /customers`, `/products` e `/inventory/boxes`, e se `GET /inventory` aceita busca/filtro.
- Se o backend rejeita `salePrice`/`unitCost` com mais de 2 casas (conferi apenas `nonnegative` em createInventoryLotSchema) e se `PATCH /customers` aceita `null` para limpar campos.
- Comportamento real do `BarcodeScanner` e de `window.open` em navegadores/PWA móveis; testes não foram executados nesta revisão.

---

## Revisão 08 — Frontend: sales / finance / receivables / payables / purchases / suppliers / nfe-imports

Caminhos relativos a `frontend/src/modules/`. Nenhum achado Crítico: dinheiro é calculado em centavos, as mutações de dinheiro/estoque usam Idempotency-Key e as datas usam o fuso de negócio.

## [Médio] Confirmação da NF-e pode não redirecionar para o pedido (callback do `mutate` perdido) e o teste não pega
- Onde: nfe-imports/hooks/useNfeImports.ts:300-306; nfe-imports/pages/NfeImportReviewPage.tsx:56-66 e 112-113; nfe-imports/pages/__tests__/NfeImportReviewPage.test.tsx:25-28 e 132
- Problema: o `onSuccess` do hook aguarda `invalidateQueries({queryKey: queryKeys.nfeImports})`. Isso refaz a busca do detalhe da nota, que agora vem `CONFIRMED`. A página troca `<ReviewForm>` pela mensagem "já foi confirmada", e `ReviewForm` (dono do `useMutation`) desmonta antes de o `mutate(..., {onSuccess: navigate})` rodar. No TanStack Query v5 os callbacks passados ao `mutate` não disparam quando o componente já desmontou. O teste não detecta isso porque o MSW nunca sobrescreve o GET `/nfe-imports/:id`, que continua devolvendo DRAFT.
- Impacto para quem usa o sistema: a importação é concluída, mas o usuário fica na tela "Esta nota já foi confirmada" em vez de ir ao pedido. Pode achar que falhou e tentar de novo, e o toast de sucesso é a única confirmação.
- Sugestão: navegar a partir do hook (`onSuccess` do `useMutation` ou `mutateAsync` seguido de `navigate`) ou usar `setQueryData` no detalhe em vez de invalidar o detalhe ativo. No teste, trocar o GET para CONFIRMED depois do POST.

## [Médio] Cancelar venda/pedido é oferecido mesmo com pagamento registrado (o backend responde 409)
- Onde: sales/pages/SaleDetailPage.tsx:89-102 e 192; purchases/pages/PurchaseDetailPage.tsx:30 e 65-71
- Problema: o botão "Cancelar" só considera `status`. O backend recusa com `SALE_HAS_PAYMENTS` / `PURCHASE_HAS_PAYMENTS` (CancelSaleReceivableUseCase / CancelPurchasePayableUseCase) quando há pagamento ativo. O texto do modal ("a conta a receber cancelada") não avisa isso.
- Impacto para quem usa o sistema: o usuário confirma o cancelamento e só então descobre que precisa estornar os pagamentos antes. Não há dica de que o caminho é Financeiro, estornar e depois cancelar.
- Sugestão: quando alguma parcela tiver `paidAmount > 0` (ou houver pagamentos), mostrar aviso com link para a conta (ou desabilitar o botão com explicação). Manter o tratamento do 409.

## [Médio] Exportação de vendas usa um período que a lista não aplica
- Onde: sales/pages/SaleListPage.tsx:20-28 e 52-69
- Problema: os campos "De/Até" só alimentam os dois `ExportButton`; `useSales(page)` ignora o período. A única indicação é um texto pequeno ("a lista mostra todas as vendas"). O padrão é do dia 1 do mês até hoje, e a lista não tem status nem busca.
- Impacto para quem usa o sistema: quem muda a data espera filtrar a tabela e vê a mesma lista. Dá a impressão de filtro quebrado ou de exportar algo diferente do que está na tela.
- Sugestão: aplicar `from/to` também na listagem (o endpoint pode aceitar) ou mover os campos para dentro de um popover/diálogo "Exportar".

## [Baixo] Criar venda/pedido e cancelar venda não invalidam o financeiro (receivables/payables)
- Onde: sales/hooks/useCreateSale.ts:18-25; sales/hooks/useCancelSale.ts:17-27; purchases/hooks/usePurchases.ts:46-48 e 63-66
- Problema: a venda cria/cancela uma conta a receber e o pedido cria uma conta a pagar, mas só `sales`/`purchases` e o estoque são invalidados. `queryKeys.receivables` não é tocado em nenhuma mutação de venda, e `queryKeys.payables` só é invalidado no cancelamento do pedido. O NF-e confirm (useNfeImports.ts:302) invalida payables; as demais criações não. Como não há `staleTime` global, o dado acaba sendo refeito ao remontar a página, mas o detalhe já em cache aparece desatualizado por um instante.
- Impacto para quem usa o sistema: janela curta em que a lista/detalhe de contas mostra o estado anterior (por exemplo, status da conta de uma venda recém-cancelada). Quem deixa a aba de contas aberta vê o dado antigo até o próximo foco.
- Sugestão: invalidar `queryKeys.receivables` em create/cancel de venda e `queryKeys.payables` em create de pedido. Centralizar em um helper (como `invalidateInventoryQueries`).

## [Baixo] Primeiro vencimento da venda aceita data passada no cliente; o backend rejeita
- Onde: sales/pages/SaleCreatePage.tsx:102-105 e 365; backend `modules/sales/interfaces/http/schemas/createSaleSchema.ts` ("não pode ser anterior a hoje")
- Problema: o front só valida o formato. Falta `min={today}` no `<input type="date">` e a checagem `< todayInBusinessTz()`. A compra tem a regra espelhada (PurchaseCreatePage.tsx:141 e `min`).
- Impacto para quem usa o sistema: o erro só aparece depois do envio. Funciona (o erro vai inline), mas a validação não é antecipada como no pedido de compra.
- Sugestão: espelhar a regra do backend (`min` + validação no `handleRegisterSale`).

## [Baixo] Total/subtotal da venda são estimativas do preço lido no scan; nenhum aviso de divergência
- Onde: sales/hooks/useSaleCart.ts:33-41 e 58; sales/pages/SaleCreatePage.tsx:292 e 320
- Problema: o preço é congelado em `salePrice` quando a variante é lida; o backend recalcula e o payload não envia valores. Além disso, o subtotal da linha usa `quantity * unitPrice` em ponto flutuante, enquanto o total usa `toCents` por item. Para `quantity` inteiro e preço com 2 casas o resultado é equivalente, mas as duas fórmulas coexistem.
- Impacto para quem usa o sistema: se o preço mudar durante a digitação, o total mostrado ≠ total gravado, e o usuário só vê o valor real no detalhe após registrar. Para as parcelas, o preview pode divergir das parcelas reais.
- Sugestão: usar uma única função de cálculo em centavos (`itemSubtotalCents`) e, após o POST, o detalhe já mostra o total real. Considerar aviso "valores sujeitos à conferência" ou revalidar o preço ao registrar.

## [Baixo] Erros de item da NF-e permanecem após o usuário corrigir; estado do formulário não acompanha refetch
- Onde: nfe-imports/pages/NfeImportReviewPage.tsx:82, 109 e 125; 66, 93 e 204
- Problema: (a) `rowErrors` só é limpo ao reenviar, então o erro do servidor permanece no card mesmo depois de a pessoa alterar o item. (b) `ReviewForm key={note.id}` guarda rascunhos inicializados uma vez; se a query do detalhe for refeita (foco da janela) e a nota tiver mudado de forma (por exemplo, reenvio do XML em outra aba, que substitui o rascunho da mesma chave), `items[position]` pode ficar `undefined` e `itemProblem` quebra. É um cenário raro e não reproduzi no navegador.
- Impacto para quem usa o sistema: mensagem de erro obsoleta que confunde. No caso raro (b), tela em branco na revisão e perda dos dados digitados.
- Sugestão: limpar `rowErrors[index]` em `patchItem`; desativar refetch automático do detalhe da revisão (`refetchOnWindowFocus: false`) ou reinicializar o form quando `updatedAt`/itens mudarem.

## [Baixo] Cobertura de teste de idempotência desigual
- Onde: purchases/pages/__tests__/PurchaseCreatePage.test.tsx, PurchaseDetailPage.test.tsx (receipts/cancel); nfe-imports/pages/__tests__/NfeImportReviewPage.test.tsx:25; payables/pages/__tests__/PayableDetailPage.test.tsx
- Problema: só SaleCreatePage.test.tsx:32 e ReceivableDetailPage.test.tsx:79 inspecionam o header `Idempotency-Key` (e a reutilização da chave num retry). Criar pedido, receber, cancelar, confirmar NF-e e pagar/estornar conta a pagar não têm essa verificação, apesar de serem operações de dinheiro/estoque.
- Impacto para quem usa o sistema: uma regressão que removesse o header ou a reutilização da chave passaria despercebida e poderia causar duplicidade de recebimento/pagamento em retry.
- Sugestão: um teste parametrizado "toda mutação financeira envia Idempotency-Key e reutiliza em retry" para as ações listadas.

## [Baixo] Invalidação de fornecedor não alcança contas a pagar nem importações de NF-e
- Onde: suppliers/hooks/useSupplierMutations.ts:7
- Problema: editar o nome do fornecedor invalida `suppliers` e `purchases`, mas a lista/detalhe de contas a pagar e as notas importadas (`supplier.match`) também exibem o nome.
- Impacto para quem usa o sistema: nome antigo em contas a pagar e na revisão de NF-e até a próxima recarga.
- Sugestão: incluir `queryKeys.payables` e `queryKeys.nfeImports` em `invalidateKeys`.

## [Baixo] Tipagem frouxa nos filtros de serviço e código morto/duplicado
- Onde: finance/services/financeService.ts:11-13 e purchases/services/purchaseService.ts:10-12 (`Object.entries(filters)` vira `any`, então `openOnly: boolean` entra em `Record<string,string|number>` sem erro); sales/utils/installments.ts:33-37 (`addDaysLocal` só é usada em teste); `formatDateTime` repetido em sales/pages/SaleDetailPage.tsx:25, finance/pages/FinanceDetailPage.tsx:18 e sales/hooks/useSaleColumns.tsx:9
- Problema: lacunas de tipo que escondem erro futuro, mais uma função morta e três cópias do formatador de data/hora.
- Impacto para quem usa o sistema: nenhum hoje; manutenção e risco de formatos divergentes.
- Sugestão: tipar `params` como `Record<string, string | number | boolean>` e filtrar explicitamente; remover `addDaysLocal`; extrair `formatDateTime` para `shared/utils`.

## [Baixo] Acessibilidade: estados de carregamento sem anúncio
- Onde: finance/pages/FinanceListPage.tsx:353; sales/pages/SaleListPage.tsx:70; nfe-imports/pages/NfeImportReviewPage.tsx:54
- Problema: mensagens de "Atualizando/Carregando…" sem `role="status"`/`aria-live`. Em contraste, os erros usam `role="alert"`.
- Impacto para quem usa o sistema: leitores de tela não anunciam o refetch de listas e filtros.
- Sugestão: `role="status"` nesses textos.

## Pontos fortes
- Dinheiro em centavos de ponta a ponta: `toCents`/`fromCents`, `moneyToSend` (valor enviado é exatamente o exibido) e `hasTooManyDecimals` (nunca arredonda em silêncio). `buildInstallments` espelha a regra do backend (piso por parcela, resto na última, vencimento recortado ao fim do mês), com testes.
- Idempotência bem desenhada: `useIdempotencyKey().run` reaproveita a chave no retry com as mesmas variáveis e renova após sucesso/mudança de dados, usada em venda, cancelamento, pedido, recebimento, cancelamento de pedido, pagamento, estorno e confirmação de NF-e.
- Datas date-only tratadas com `todayInBusinessTz` (America/Sao_Paulo), aritmética em UTC (`addDaysToDateOnly`) e `formatDateOnly` com `timeZone: 'UTC'`, o que evita off-by-one. Pagamento não aceita data futura (RegisterPaymentModal.tsx:128) e o formulário de pedido espelha as regras do backend.
- Fluxo de pagamento robusto: valida saldo e 2 casas, bloqueia duplo envio com `isPending`, atualiza o detalhe pela resposta (`setQueryData`) e invalida a origem (venda/pedido). Após erro, o detalhe é relido, o que mostra se o pagamento chegou a ser gravado.
- Erros mostrados uma vez só (inline quando mapeados, alerta quando não), com mapeamento `paymentTerms.firstDueDate` para o campo; gating por permissão nas rotas e com `<Can>` nas ações (pagar, estornar, cancelar, receber).
- A revisão da NF-e tem lógica pura e testável em `utils/review.ts` (unidades inteiras, soma das parcelas, motivo de bloqueio) e erros atribuídos ao item (`errorItemIndex`).

## Não verificado
- Se o backend aceita duas linhas da NF-e vinculadas à mesma variante (o pedido normal rejeita "Variante duplicada"; ConfirmNfeImportUseCase.ts:117-144 não foi lido com detalhe). O front não impede esse vínculo (NfeItemCard/review.ts).
- `SaleBarcodeInput`, `useProductByBarcode`, `FormAutocomplete`, `Modal`, `ExportButton`, `parseApiErrorSync`/`applyFieldErrors` (infra compartilhada, fora do escopo).
- Comportamento real no navegador do achado do `mutate` desmontado (inferido do comportamento documentado do TanStack Query v5 e do fluxo de invalidação; não executei a página).
- Estado do cache pós-mutação com `staleTime` por padrão 0: assumi que não há configuração global fora de `src` (busquei `staleTime`/`refetchOnWindowFocus` só em `frontend/src`).
- Suíte de testes não foi executada nesta revisão; só li o código dos testes.
