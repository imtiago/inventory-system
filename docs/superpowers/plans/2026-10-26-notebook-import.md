# Migração do caderninho (Bloco E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer as dívidas anotadas no caderno para contas a receber ("dívida anterior — caderninho", sem multa/juros, sem venda nem estoque), por planilha CSV ou lançamento rápido, com revisão linha a linha antes de gravar, perfil/limite de crédito aplicados na confirmação e desfazer seguro.

**Architecture:** Novo módulo backend `legacy-import` (alias `@legacy-import/*`): leitor de CSV e validação de linhas puros; detecção de nomes parecidos pura; lote (`LegacyImportBatch`) e linhas (`LegacyImportRow`) persistidos como rascunho editável; confirmação numa transação idempotente que cria clientes, documentos `RECEIVABLE` com origem `LEGACY` (`noLateFees = true`) e aplica perfil/limite pelo serviço do crediário. Parcela "a combinar" (`dueDateUnknown`) nunca conta como vencida e pode ser parcelada depois.

**Tech Stack:** Fastify 5 + `@fastify/multipart`, Prisma 6, Zod 4, `node:test`; React 19, TanStack Query 5, Tailwind (tokens), Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-26-notebook-import-design.md`

**Branch:** `feat/notebook-import` (a partir da `main` com `feat/credit` mergeada; a Task 2 é pura e pode começar antes; a Task 1 só importa `CreditProfileCode` do crediário).

## Global Constraints

- Leia `CLAUDE.md` inteiro. `git add` com caminhos explícitos. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Banco (repetir em todo brief de subagente):** NUNCA `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, nem `prisma migrate diff` em qualquer forma. Por migration: (1) `cd backend && PGCONTAINER=api_db_1 npm run backup-db`; (2) SQL à mão, aditivo, válido em banco vazio e com dados; (3) `npx prisma migrate deploy` e `npm run test:db:prepare`; (4) `npx prisma generate`. Timestamp maior que a última migration (crédito usa `202610291000NN`; aqui `20261030100000`).
- **Interfaces do crediário consumidas (nomes fixos do plano `2026-10-26-credit.md`; reconfira no código mergeado):** `CreditProfileCode` (`NEW`, `REGULAR`, `GOOD`, `EXCELLENT`; rótulos Novo/Regular/Bom/Excelente), `CreditProfileReader.byCode()`, `CustomerCreditRepository.lockMany(ids)` (ORDER BY id), `CustomerCreditService.applyChange(input: CreditChangeInput)` com `source: CreditChangeSource.LEGACY_IMPORT`, `CreditExposureReader.forCustomer()`, `CreditHistoryReader.forCustomers()`, `FinancialDocument.noLateFees` e `ICreateFinancialDocumentInput.noLateFees`, permissão `credit.manage`. Pagamento das dívidas antigas: permissão existente **`finance.pay`** (a spec diz `receivables.pay`, que não existe).
- **Suposição da onda 9:** FKs `FinancialParcel → FinancialDocument` e `Payment → FinancialParcel` são `RESTRICT` (migration `20261027100000_wave9_polish_db`); parcela sem pagamento pode ser apagada.
- Dinheiro em centavos; datas de negócio `America/Sao_Paulo`; datas só-dia `YYYY-MM-DD` na API, `dd/mm/aaaa` no CSV e na tela.
- Nenhuma dependência nova (CSV lido à mão; `TextDecoder` do Node 22 com ICU completo decodifica `windows-1252`).
- Situações em inglês no código, como os outros enums: lote `DRAFT`/`CONFIRMED`/`REVERTED` (spec: RASCUNHO/CONFIRMADO/DESFEITO); linha `OK`/`WARNING`/`ERROR`/`IGNORED` (spec: OK/AVISO/ERRO/IGNORADA). Rótulos em PT na tela.
- Frontend: tokens, `MoneyInput`, `DataTable` com `mobile`, `lazyPage()`, `COVERED_POSTS` para confirmar/desfazer/parcelar; 360/768/≥1280 px nos dois temas.
- Pronto = backend `typecheck` + `npm test` (2× nas tarefas com transação); frontend `lint` 0, `typecheck` 0, `test`, `build`.

## Review Focus

1. CSV salvo pelo Excel em português (ANSI/windows-1252, `;`, BOM ausente) com "João" e "R$ 1.234,56" chega íntegro, sem "Ã£" nem valor errado — Task 1.
2. Nomes diferentes mas próximos ("Maria Silva" × "Mariana Silva", "João Souza" × "Joana Souza", "Ana Paula" × "Ana Lúcia") **não** são marcados como a mesma pessoa; "Maria Silva" × "Maria S." e "José da Silva" × "Jose Silva" são — Task 2.
3. Parcela "a combinar" não aparece como vencida em nenhum lugar (lista, detalhe, resumo, dashboard, CSV, bloqueio do crediário, revisão de limite) — Task 3.
4. Confirmação com falha no meio (ex.: cliente vinculado excluído) não grava nada; repetir com a mesma chave não duplica; duas confirmações simultâneas → uma só — Task 5.
5. Dívida antiga com vencimento anotado no passado: entra sem multa/juros, conta no saldo/limite e NÃO no atraso nem na pontuação (decidido 2026-10-26; ver Open questions) — Task 5.

---

## Ordem e paralelismo

| Task | Depende de | Paralelo com |
|---|---|---|
| 1 Leitura do CSV e validação de linha (puro) | crediário Task 4 (`CreditProfileCode`) | 2, 3 |
| 2 Nomes parecidos (puro) | — | 1 |
| 3 Modelo de dados, origem LEGACY e "a combinar" | crediário mergeado | 1, 2 |
| 4 Lotes: upload, lançamento rápido, edição, revisão | 1, 2, 3 | — |
| 5 Confirmar e desfazer | 4 | 6 |
| 6 Parcelar saldo | 3 | 5 |
| 7 Front: lotes, upload, revisão, lançamento rápido | 4, 5 | 8 |
| 8 Front: etiqueta "Caderninho", parcelar saldo, modelo e README | 3, 6 | 7 |
| 9 Verificação final e QA visual | todas | — |

Migration única: Task 3 `20261030100000_legacy_import`.

## Open questions

- **Dívida antiga com vencimento no passado — DECIDIDO (2026-10-26):** conta no saldo e no limite, mas **não** conta como atraso para bloqueio do crediário e **não** afeta perfil/pontuação.
- **Soma dos vencimentos ≠ saldo em aberto** (spec silente): este plano trata como `ERROR` "A soma dos vencimentos (X) é diferente do saldo em aberto (Y).". **Não bloqueia.**
- **Regra do limite na confirmação "configurável"**: este plano a expõe como opção do lote (`limitRule`: `MAX_OF_PROFILE_AND_BALANCE` padrão, ou `PROFILE_ONLY`). **Não bloqueia.**
- **"Parcelar saldo" conta como renegociação na pontuação do crédito?** Este plano: não (a parcela "a combinar" nunca esteve vencida). **Não bloqueia.**
- **Valores iniciais do crediário** (perfis/limites usados aqui) — herdado do plano do crediário; **não bloqueia** a importação, só o uso do crediário.

---

### Task 1: Leitura do CSV e validação de linha (puro)

**Files:**
- Create: `backend/src/modules/legacy-import/domain/{csvReader.ts,brParsers.ts,legacyRow.ts,legacyTemplate.ts}`; alias `"@legacy-import/*": ["modules/legacy-import/*"]` em `backend/tsconfig.json`
- Test: `backend/src/modules/legacy-import/domain/__tests__/{csvReader,brParsers,legacyRow}.test.ts`

**Interfaces:**
- Consumes: `MAX_AMOUNT_CENTS`; `CreditProfileCode` (`@credit/domain/CreditProfileCode`); `todayInBusinessTz` (só no chamador; funções recebem `today`).
- Produces:
  - `decodeCsvBytes(bytes: Uint8Array): string` — tira BOM UTF-8; UTF-8 estrito (`new TextDecoder("utf-8", { fatal: true })`); se falhar, `windows-1252`.
  - `parseCsv(text: string): { header: string[]; rows: { line: number; cells: string[] }[] }` — separador detectado, aspas, linhas vazias ignoradas.
  - `LEGACY_COLUMNS = ["nome","celular","data_compra","descricao","valor_total","valor_pago","vencimentos","perfil","observacao"] as const`; `mapHeader(header: string[]): Record<LegacyColumn, number | null>` (normaliza acentos/caixa/espaços; `nome` e `valor_total` obrigatórias → `ValidationError` "Coluna obrigatória ausente: nome").
  - `parseBrMoneyToCents(text: string): number | null` (mesmas regras do `MoneyInput` do front: "," decimal, "." milhar; ponto + 3 dígitos = milhar; ponto + 1–2 = decimal; aceita prefixo "R$" e espaços; > 2 casas ou negativo → null).
  - `parseBrDate(text: string): string | null` (`d/m/aaaa` ou `dd/mm/aaaa` → `YYYY-MM-DD`; data inexistente → null).
  - `normalizePhone(text: string): string | null` (só dígitos; tira `55` inicial quando sobram 12–13; válido = 10–11 dígitos, como `customerSchemas`).
  - `parseDueDates(text: string): { date: string; amountCents: number }[] | null` ("dd/mm/aaaa=valor; dd/mm/aaaa=valor").
  - `type LegacyIssueCode = "NAME_REQUIRED" | "INVALID_AMOUNT" | "ZERO_AMOUNT" | "PAID_EXCEEDS_TOTAL" | "INVALID_DATE" | "INVALID_DUE_DATES" | "DUE_DATES_SUM_MISMATCH" | "UNKNOWN_PROFILE" | "NO_PHONE" | "INVALID_PHONE" | "NO_DATE" | "FUTURE_DATE" | "SIMILAR_CUSTOMER" | "SIMILAR_ROW"`; `interface LegacyIssue { code: LegacyIssueCode; severity: "ERROR" | "WARNING"; field: LegacyColumn | null; message: string; details?: Record<string, unknown> }`.
  - `interface LegacyRowData { name: string; phone: string | null; purchaseDate: string | null; description: string | null; totalCents: number; paidCents: number; openCents: number; dueDates: { date: string; amountCents: number }[] | null; profileCode: CreditProfileCode | null; notes: string | null }`.
  - `validateLegacyRow(raw: Record<LegacyColumn, string>, today: string): { data: LegacyRowData; issues: LegacyIssue[] }` (sem as `SIMILAR_*`, que vêm da Task 2). Perfil aceita "Novo"/"Regular"/"Bom"/"Excelente" sem acento/caixa.
  - `buildLegacyTemplateCsv(): string` (BOM, `;`, CRLF, cabeçalho + 2 linhas de exemplo).

- [ ] **Step 1: Testes (falhando)**
```ts
test("UTF-8 com BOM e ';' → cabeçalho limpo (sem \\uFEFF) e células")
test("windows-1252 (bytes de 'João;1.234,56') → 'João' e 1.234,56")  // Review Focus 1
test("separador ',' com valor entre aspas \"1.234,56\" e aspas escapadas \"\"")
test("linhas vazias e só com ';;;' são ignoradas; número da linha preservado para mensagens")
test("CRLF, LF e última linha sem quebra")
test("cabeçalho 'Nome; Valor Total ; Valor_Pago' é reconhecido; sem 'nome' → 'Coluna obrigatória ausente: nome'")
test("parseBrMoneyToCents: '1.234,56'→123456, '39.9'→3990, '1.000'→100000, 'R$ 12,50'→1250, '1,234'→null, '-5'→null")
test("parseBrDate: '5/3/2026'→'2026-03-05', '31/02/2026'→null, '2026-03-05'→null")
test("normalizePhone: '(11) 98888-7777'→'11988887777', '+55 11 98888-7777'→'11988887777', '9888'→null")
test("linha: total 100, pago 120 → ERROR PAID_EXCEEDS_TOTAL; total 100, pago 100 → ERROR ZERO_AMOUNT; sem nome → ERROR NAME_REQUIRED")
test("linha: sem celular → WARNING NO_PHONE; celular inválido → WARNING INVALID_PHONE (phone null); data futura → WARNING FUTURE_DATE; sem data → WARNING NO_DATE")
test("vencimentos '10/11/2026=50,00; 10/12/2026=50,00' com saldo 100 → ok; somando 90 → ERROR DUE_DATES_SUM_MISMATCH")
test("perfil 'excelente' → EXCELLENT; 'VIP' → ERROR UNKNOWN_PROFILE")
test("modelo: começa com BOM, 9 colunas na ordem da spec, lido de volta por parseCsv+mapHeader sem erro")
```
- [ ] **Step 2:** `npx tsx --import ./src/test/bootstrap.ts --test src/modules/legacy-import/domain/__tests__/*.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** Regras do leitor que os testes não fixam sozinhos:
```ts
// Separador: na 1ª linha não vazia, conte ';' e ',' fora de aspas; ';' se houver algum, senão ','.
// Campo: aspas só no início do campo abrem citação; '""' dentro = '"'; quebra de linha dentro de aspas faz parte do campo.
// Fora de aspas, espaços nas pontas são removidos. Linha cujas células são todas vazias é ignorada.
// Limites: texto > 1 MB ou > 2000 linhas de dados → ValidationError "Arquivo grande demais (máx. 2.000 linhas)."
// Célula começando com =,+,-,@ é texto comum (nunca avaliada); nome guardado como veio (trim + espaços colapsados).
```
- [ ] **Step 4:** PASS; `typecheck`.
- [ ] **Step 5: Commit** — `feat(legacy-import): CSV reader (BOM, cp1252, ; or ,) and notebook row validation`

### Task 2: Detecção de nomes parecidos (puro)

**Files:**
- Create: `backend/src/modules/legacy-import/domain/nameSimilarity.ts`
- Test: `backend/src/modules/legacy-import/domain/__tests__/nameSimilarity.test.ts`

**Interfaces:**
- Produces: `normalizeName(name: string): string[]` (tokens); `nameMatch(a: string, b: string): "SAME" | "SIMILAR" | null`; `findSimilar(name: string, candidates: { id: string; name: string; phone?: string | null }[], phone?: string | null): { id: string; match: "SAME" | "SIMILAR" | "PHONE" }[]` (no máximo 5, `SAME` e `PHONE` primeiro).

- [ ] **Step 1: Testes (falhando)**
```ts
const similar: [string, string][] = [["Maria Silva", "Maria S."], ["Maria Silva", "maria  silva"], ["José da Silva", "Jose Silva"],
  ["Ana Souza", "Ana Sousa"], ["Maria", "Maria Silva"], ["M. Silva", "Maria Silva"]];
const different: [string, string][] = [["Maria Silva", "Mariana Silva"], ["João Souza", "Joana Souza"], ["Ana Paula", "Ana Lúcia"],
  ["Maria Silva", "Maria Santos"], ["Carlos", "Carla"]];
test("parecidos", () => similar.forEach(([a, b]) => assert.ok(nameMatch(a, b) !== null, `${a} × ${b}`)));
test("diferentes", () => different.forEach(([a, b]) => assert.equal(nameMatch(a, b), null, `${a} × ${b}`)));  // Review Focus 2
test("iguais após normalizar → SAME", () => assert.equal(nameMatch("JOSÉ  da silva", "Jose da Silva"), "SAME"));
test("mesmo celular com nome diferente → PHONE")
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementar** (o algoritmo é a decisão):
```ts
// normalizeName: NFD sem diacríticos, minúsculas, '.' e '-' viram espaço, remove o resto da pontuação,
//   colapsa espaços, descarta partículas {da, de, do, das, dos, e}.
// SAME: listas de tokens iguais.
// SIMILAR (qualquer regra):
//  (a) abreviação: mesmo nº de tokens ou um deles com 1 token; alinhados em ordem, cada par é igual
//      OU um é inicial (1 letra) do outro; o 1º token tem de ser igual ou inicial; ao menos 1 par igual com ≥ 3 letras.
//      Nome de 1 token só casa se for igual ao 1º token do outro ("Maria" × "Maria Silva").
//  (b) erro de digitação: mesmo nº de tokens (≥ 2), todos iguais menos um par, e esse par tem Levenshtein = 1
//      com ambos ≥ 5 letras e mesma 1ª letra ("souza"/"sousa"; "maria"/"mariana" tem distância 2 → não).
// PHONE: celulares normalizados iguais.
```
- [ ] **Step 4:** PASS. - [ ] **Step 5: Commit** — `feat(legacy-import): conservative similar-name detection with accent and abbreviation handling`

---

### Task 3: Modelo de dados, origem `LEGACY` e parcela "a combinar"

**Files:**
- Migration `20261030100000_legacy_import`: `ALTER TYPE "FinancialOriginType" ADD VALUE 'LEGACY'` (não usar o valor nesta mesma migration); `FinancialParcel` += `dueDateUnknown BOOLEAN NOT NULL DEFAULT false`; enums `"LegacyImportStatus"` (`DRAFT`,`CONFIRMED`,`REVERTED`), `"LegacyImportSource"` (`CSV`,`MANUAL`), `"LegacyImportRowStatus"` (`OK`,`WARNING`,`ERROR`,`IGNORED`); `"LegacyImportBatch"` (`id`, `status DEFAULT 'DRAFT'`, `source`, `fileName`, `summary JSONB`, `limitRule TEXT NOT NULL DEFAULT 'MAX_OF_PROFILE_AND_BALANCE'`, `createdById` FK users SET NULL, `createdAt`, `confirmedById`, `confirmedAt`, `revertedById`, `revertedAt`), índice `(status, createdAt)`; `"LegacyImportRow"` (`id`, `batchId` FK CASCADE, `line INT`, `raw JSONB`, `data JSONB`, `issues JSONB`, `status`, `customerAction JSONB` (`{"kind":"NEW"}` padrão), `customerId` FK Customer SET NULL, `financialDocumentId` FK RESTRICT, `createdAt`), índice `(batchId, line)`.
- Modify: `backend/src/modules/finance/domain/enums/FinancialOriginType.ts`, `receivableStatus.ts` (`ParcelAmounts.dueDateUnknown?: boolean`), `FinancialParcel.ts` (+ `dueDateUnknown`), mappers/repositório de parcelas, `PrismaFinancialDocumentReadRepository.ts` (filtros e somas de vencido/`OVERDUE`/`dueTo` ignoram `dueDateUnknown`), `PrismaDashboardReadRepository.ts` (vencido e "vence em 7 dias"), `reportControllers.ts` (`ORIGIN_LABEL.LEGACY = "Caderninho"`, vencimento "A combinar" no CSV), DTO de parcela (`dueDateUnknown`), consultas do crediário `CreditExposureReader` e `CreditHistoryReader` (Prisma) e o bloqueio por atraso; fixtures de finanças
- Test: `backend/src/modules/finance/domain/services/__tests__/receivableStatus.test.ts`, `backend/src/modules/finance/infrastructure/http/__tests__/unknownDueDate.test.ts`, caso no teste do dashboard e no de exposição de crédito

**Interfaces:**
- Consumes: crediário (`CreditExposureReader`, `CreditHistoryReader`).
- Produces: `FinancialOriginType.LEGACY`; `FinancialParcel.dueDateUnknown: boolean`; `ICreateFinancialDocumentInput.parcels[i].dueDateUnknown?: boolean`; `hasOverdueBalance`/`parcelStatus` devolvem não-vencido quando `dueDateUnknown`; DTO de parcela `{ …, dueDateUnknown: boolean }`; documento `originLabel` "Saldo anterior — caderninho".

- [ ] **Step 1: Testes (falhando)**
```ts
test("parcelStatus com dueDateUnknown e vencimento no passado → OPEN; hasOverdueBalance → false")
test("documento LEGACY com parcela a combinar: lista com status=OVERDUE não traz; resumo overdue 0; detalhe mostra 'A combinar'")  // Review Focus 3
test("dashboard: overdue e dueNext7Days ignoram a parcela a combinar")
test("CSV de contas a receber: origem 'Caderninho', vencimento 'A combinar'")
test("exposição de crédito: a combinar soma no saldo, não no atraso; não bloqueia crediário")
```
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** migration; implementar. - [ ] **Step 4:** PASS; finanças, dashboard, relatórios e crédito 2×.
- [ ] **Step 5: Commit** — `feat(finance): LEGACY receivable origin and to-be-agreed parcels that never count as overdue`

---

### Task 4: Lotes — upload, lançamento rápido, edição e revisão

**Files:**
- Create: `backend/src/modules/legacy-import/{application,infrastructure,interfaces}/…` — `LegacyImportBatchRepository` (+ Prisma), use cases `UploadLegacyCsvUseCase`, `CreateManualLegacyBatchUseCase`, `AddLegacyRowsUseCase`, `UpdateLegacyRowUseCase`, `GetLegacyBatchUseCase`, `ListLegacyBatchesUseCase`, `DeleteLegacyDraftUseCase`, serviço `LegacyBatchReviewer` (revalida linhas e recalcula `SIMILAR_*` do lote inteiro e o resumo), schemas, `legacyImportRoutes.ts` (prefixo `/legacy-imports`, multipart registrado dentro do plugin como na NF-e)
- Modify: `app.ts`, fixtures `frontend/src/test/fixtures/legacy-import/*.json`
- Test: `backend/src/modules/legacy-import/infrastructure/http/__tests__/legacyBatches.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `CreditProfileReader`.
- Produces (todas `credit.manage`):
  - `GET /legacy-imports/template.csv` → `buildLegacyTemplateCsv()` com `csvHeaders("modelo-caderninho", hoje)`.
  - `POST /legacy-imports/csv` (multipart, 1 arquivo ≤ 1 MB) → 201 `LegacyBatchDTO`.
  - `POST /legacy-imports` `{ source: "MANUAL" }` → lote vazio; `POST /legacy-imports/:id/rows` `{ customer: { existingId: string } | { name: string; phone?: string | null }; debts: { amount: number; paid?: number; purchaseDate?: string; description?: string; notes?: string; dueDates?: { date: string; amount: number }[] }[] }` → uma linha por dívida.
  - `PATCH /legacy-imports/:id/rows/:rowId` `{ data?: Partial<LegacyRowDataInput>; customerAction?: { kind: "NEW" } | { kind: "LINK"; customerId: string } | { kind: "SAME_AS_ROW"; rowId: string }; ignored?: boolean }`.
  - `GET /legacy-imports?page&limit`, `GET /legacy-imports/:id`, `DELETE /legacy-imports/:id` (só `DRAFT`).
  - `LegacyBatchDTO { id; status; source; fileName; createdAt; createdBy; summary: { newCustomers; existingCustomers; openTotal; rows; warnings; errors; ignored }; rows: LegacyRowDTO[] }`; `LegacyRowDTO { id; line; status; data: LegacyRowData (valores em reais); issues: LegacyIssue[]; customerAction; suggestions: { customerId?: string; rowId?: string; name: string; match: "SAME" | "SIMILAR" | "PHONE" }[] }`.
  - Lote fora de `DRAFT` → 409 `LEGACY_BATCH_NOT_DRAFT`.

- [ ] **Step 1: Testes (falhando)**
```ts
test("upload do modelo preenchido com 3 linhas → DRAFT; resumo: 2 novos, 1 existente (nome igual a cliente tx-test), total em aberto")
test("linha com nome parecido a cliente existente → WARNING SIMILAR_CUSTOMER com sugestão; duas linhas da mesma pessoa → SIMILAR_ROW")
test("PATCH corrige 'valor_pago' e a linha sai de ERROR para OK; resumo recalculado")
test("PATCH customerAction LINK para cliente inexistente → 404 CUSTOMER_NOT_FOUND")
test("lançamento rápido: cliente novo com 2 dívidas → 2 linhas no lote MANUAL")
test("arquivo sem coluna nome → 400 'Coluna obrigatória ausente: nome'; arquivo > 1 MB → 400")
test("VENDEDOR → 403 em todas as rotas")
```
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar (sugestões comparam com todos os clientes por `name, phone` — loja pequena; acima de 5.000 clientes, restringir pelo 1º token normalizado via `ILIKE` e documentar). - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(legacy-import): import batches from CSV or quick entry with editable review`

### Task 5: Confirmar e desfazer o lote

**Files:**
- Create: `ConfirmLegacyBatchUseCase.ts`, `RevertLegacyBatchUseCase.ts`
- Modify: `legacyImportRoutes.ts`, `CLAUDE.md` (travas), `frontend/src/test/setup.ts` (`COVERED_POSTS` += `/\/legacy-imports\/[^/]+\/(confirm|revert)$/`)
- Test: `backend/src/modules/legacy-import/infrastructure/http/__tests__/legacyConfirm.test.ts`

**Interfaces:**
- Consumes: Task 4; `CreateCustomerUseCase` (aninhado, código gerado normalmente); `CreateFinancialDocumentUseCase` com `noLateFees: true`; `CustomerCreditRepository.lockMany`; `CustomerCreditService.applyChange`; `CreditProfileReader.byCode`; `FinancialDocumentRepository.lockByOrigin`/`hasPayments`.
- Produces:
  - `POST /legacy-imports/:id/confirm` (`credit.manage`, `idempotent(…, { timeout: 60_000 })`) `{ limitRule?: "MAX_OF_PROFILE_AND_BALANCE" | "PROFILE_ONLY" }` → `LegacyBatchDTO` `CONFIRMED`.
  - `POST /legacy-imports/:id/revert` (`credit.manage`, `idempotent`) → `REVERTED`.
  - Erros: 422 `LEGACY_BATCH_HAS_ERRORS` "Corrija as linhas com erro antes de confirmar." (details: linhas); 422 `UNRESOLVED_SIMILAR_NAMES` "Decida se os nomes parecidos são a mesma pessoa." (linha com `SIMILAR_*` e `customerAction` ainda `NEW` sem confirmação explícita `confirmedNew: true`); 409 `LEGACY_BATCH_HAS_PAYMENTS` "Alguma dívida deste lote já recebeu pagamento." no desfazer.
- Fluxo da confirmação (travas: lote `FOR UPDATE` → clientes vinculados `lockMany` (ORDER BY id) → criações): cria clientes `NEW` (linhas `SAME_AS_ROW` reutilizam o da linha alvo); por linha não ignorada, documento `RECEIVABLE`/`LEGACY`/`originId = row.id`/`noLateFees = true` com parcelas = `dueDates` ou uma parcela de `openCents` vencendo hoje com `dueDateUnknown = true`; grava `financialDocumentId` na linha; por cliente, `applyChange({ profileCode: perfil da linha (ou mantém o atual / NEW para cliente novo), limitCents, source: LEGACY_IMPORT, reason: "Migração do caderninho (lote <id curto>)" })` com `limitCents` = `MAX_OF_PROFILE_AND_BALANCE` → max(limite atual, limite inicial do perfil, saldo aberto total do cliente depois da importação) ou `PROFILE_ONLY` → limite inicial do perfil; lote `CONFIRMED` com resumo final.
- Desfazer: lote `FOR UPDATE` → documentos do lote `ORDER BY id` `FOR UPDATE` → `hasPayments` → cancela todos → `REVERTED`. Clientes, perfis e limites ficam (histórico preservado).

- [ ] **Step 1: Testes (falhando)**
```ts
test("confirma: cliente novo criado com código, documento LEGACY noLateFees, parcela única a combinar; perfil Bom aplicado com histórico LEGACY_IMPORT")
test("linha com vencimentos → parcelas nas datas; vencimento passado entra sem encargos, conta no limite e não bloqueia por atraso nem afeta a pontuação")  // Review Focus 5
test("limite: perfil Novo (300) e saldo importado 450 → limite 450; PROFILE_ONLY → 300")
test("linha com ERROR → 422 LEGACY_BATCH_HAS_ERRORS; SIMILAR sem decisão → 422 UNRESOLVED_SIMILAR_NAMES")
test("falha no meio (cliente vinculado apagado entre revisão e confirmação) → nada gravado")  // Review Focus 4
test("mesma Idempotency-Key → replay, sem duplicar; duas confirmações simultâneas com chaves diferentes → uma 200, outra 409 LEGACY_BATCH_NOT_DRAFT")  // Review Focus 4 (2×)
test("desfazer sem pagamento → documentos CANCELED, lote REVERTED, clientes mantidos")
test("desfazer com pagamento em uma dívida → 409 LEGACY_BATCH_HAS_PAYMENTS e nada muda")
test("pagamento de dívida antiga por VENDEDOR (finance.pay) funciona e não cobra multa/juros")
```
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar. - [ ] **Step 4:** PASS 2×.
- [ ] **Step 5: Commit** — `feat(legacy-import): atomic idempotent batch confirmation with credit profile/limit and safe undo`

### Task 6: Parcelar saldo "a combinar"

**Files:**
- Create: `backend/src/modules/finance/application/useCases/commands/SplitUnknownDueParcelUseCase.ts`
- Modify: `FinancialDocument.ts` (`splitUnknownDueParcel`), `FinancialParcelRepository` (+ `replaceForSplit`), `PrismaFinancialParcelRepository.ts`, `financialDocumentRoutes.ts` (só recebíveis), `paymentSchemas.ts` (schema do corpo)
- Test: `backend/src/modules/finance/infrastructure/http/__tests__/splitUnknownDueParcel.test.ts`

**Interfaces:**
- Produces:
  - `POST /receivables/:id/parcels/:parcelId/split` (`credit.manage`, `idempotent`) `{ parcels: { dueDate: string; amount: number }[] }` (1..24, datas ≥ hoje, crescentes) → detalhe do documento.
  - `FinancialDocument.splitUnknownDueParcel(parcelId: string, parts: { amountCents: number; dueDate: string }[], today: string): { closedParcel: FinancialParcel | null; removedParcelId: string | null; newParcels: FinancialParcel[] }` — só parcela `dueDateUnknown` de documento não cancelado (senão 422 `PARCEL_NOT_TO_BE_AGREED`); Σ partes = restante (senão 422 `SPLIT_TOTAL_MISMATCH` "A soma das parcelas deve ser igual ao saldo (R$ X)."). Sem pagamento → parcela removida; com pagamento parcial → a parcela fica com o valor já pago, vencimento hoje e `dueDateUnknown = false` (quitada) e o restante vira as novas parcelas.
  - `FinancialParcelRepository.replaceForSplit(result): Promise<void>` (na transação, sob a trava do documento).

- [ ] **Step 1: Testes (falhando)** — saldo 300,00 a combinar → 3 × 100,00 mensais, status do documento correto; com 50,00 já pago → parcela antiga fecha em 50,00 e as novas somam 250,00; soma diferente → 422; parcela comum (não a combinar) → 422; pagar e estornar continuam funcionando nas novas; VENDEDOR → 403.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar. - [ ] **Step 4:** PASS 2×.
- [ ] **Step 5: Commit** — `feat(finance): split a to-be-agreed legacy balance into dated parcels`

---

### Task 7: Frontend — lotes, upload, revisão e lançamento rápido

**Files:**
- Create: `frontend/src/modules/legacy-import/{routes.tsx,types.ts,services/legacyImportService.ts,hooks/*,pages/LegacyImportListPage.tsx,pages/LegacyImportBatchPage.tsx,pages/LegacyQuickEntryPage.tsx,components/LegacyRowEditor.tsx,components/SimilarNameChooser.tsx,components/LegacyBatchSummary.tsx}`
- Modify: `routes.ts` (`/finance/legacy-imports`, grupo "Financeiro", rótulo "Migração do caderninho", `credit.manage`), `keys.ts` (`legacyImports`, `legacyImport(id)`)
- Test: `LegacyImportListPage.test.tsx`, `LegacyImportBatchPage.test.tsx`, `LegacyQuickEntryPage.test.tsx`

- [ ] **Step 1: Testes (falhando)** — etapas visíveis (baixar modelo → enviar CSV ou lançamento rápido → revisar → confirmar); tabela de revisão com situação por linha (`toneFor`), avisos legíveis, edição na própria linha (no celular, cartão expansível com os campos), filtro "só com aviso/erro", "Ignorar linha"; escolha para nome parecido ("É a mesma pessoa: <nome>" / "Criar novo"); resumo; botão Confirmar desabilitado com erro ou parecido pendente; desfazer com `ConfirmDialog`; lançamento rápido busca/cria cliente (`EntitySearchSelect`) e adiciona várias dívidas com `MoneyInput`; idempotência no confirmar/desfazer.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar; invalidar `receivables`, `customers`, `dashboard`, `customerCredit` ao confirmar/desfazer. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(legacy-import-ui): notebook migration batches, review table and quick entry`

### Task 8: Frontend — etiqueta "Caderninho", parcelar saldo, modelo e README

**Files:**
- Create: `frontend/src/modules/finance/components/SplitParcelModal.tsx`
- Modify: `FinanceListPage.tsx`/`FinanceDetailPage.tsx` (etiqueta "Caderninho" para `LEGACY`; vencimento "A combinar"; ação "Parcelar saldo" com `credit.manage`), `CustomerDetailsPage.tsx`/`CustomerCreditCard.tsx` (dívidas antigas com etiqueta e link para contas a receber filtradas pelo cliente), `frontend/src/shared/utils/statusTone.ts` se precisar de tom para "A combinar", `COVERED_POSTS` (+ `/\/receivables\/[^/]+\/parcels\/[^/]+\/split$/`); `README.md` raiz: seção "Migração do caderninho — fotos do caderno" (fotografar páginas → Claude transcreve para o modelo CSV → enviar → revisar; nada é gravado sem a conferência)
- Test: `SplitParcelModal.test.tsx`, `FinanceDetailPage.test.tsx`

- [ ] **Step 1: Testes (falhando)** — etiqueta e "A combinar" na lista/detalhe; parcela a combinar nunca com tom de vencida; modal de parcelar gera N parcelas mensais iguais a partir de uma data (última com o resto), permite editar valores/datas e mostra a diferença até a soma bater; envia com chave de idempotência.
- [ ] **Step 2:** FAIL. - [ ] **Step 3:** implementar. - [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(legacy-import-ui): notebook tag, split balance modal and photo transcription procedure`

### Task 9: Verificação final e QA visual

- [ ] Backend `typecheck`, `npm test` 2×, `build`; frontend `lint`, `typecheck`, `test`, `build`.
- [ ] Roteiro manual com um CSV salvo pelo Excel (ANSI) e outro pelo Google Sheets (UTF-8, `,`): enviar, revisar, juntar nomes, confirmar, pagar uma dívida, tentar desfazer (409), parcelar um saldo.
- [ ] QA visual 375/768/1280, claro/escuro: lista de lotes, revisão, lançamento rápido, detalhe de conta "Caderninho", modal de parcelar.
- [ ] `CLAUDE.md` (regras do caderninho, travas do lote) e `docs/HISTORICO.md`.
- [ ] Commit — `docs: notebook migration rules and history`
