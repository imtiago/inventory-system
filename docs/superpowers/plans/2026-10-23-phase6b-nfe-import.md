# Fase 6B — Importação de NF-e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar o XML da NF-e de compra como rascunho revisável e, na confirmação, criar fornecedor, produtos/variantes, pedido de compra, contas a pagar e (opcionalmente) a entrada no estoque, numa transação.

**Architecture:** Parser puro (`fast-xml-parser`) → `NfeDocument`; rascunho persistido (`NfeImport` com payload JSON) com sugestões por mapeamento fornecedor+código e por código de barras; confirmação reusa os casos de uso da 6A (pedido, contas a pagar com parcelas explícitas, recebimento) e grava `SupplierProductMapping`.

**Tech Stack:** Fastify 5 + `@fastify/multipart`, Prisma 6, Zod 4, `fast-xml-parser`, `node:test`; React 19, TanStack Query 5, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase6b-nfe-import-design.md`

## Global Constraints

- Branch `feat/phase6b-nfe-import`; `git add`/`git rm` com caminhos explícitos.
- **Banco:** nunca usar `--shadow-database-url`, `--from-migrations`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push` nem nada que apague/reinicie um banco. Única forma de diff: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (só leitura) → SQL à mão → `npx prisma migrate deploy` → `npx prisma generate`.
- Respostas `{ data }` / `{ data, pagination }`; `limit` ≤ 100; dinheiro em centavos no domínio, reais com 2 casas na API; datas `YYYY-MM-DD`.
- Erros pelas classes de `@shared/domain/errors`, mensagens PT, códigos exatamente como na spec; controllers sem `catch`; entrada via `parseInput`.
- Permissões: `purchases.write` (e `purchases.receive` para confirmar com entrada); `routeGate` e matriz estendidos.
- Testes paralelos: dados `tx-test-` com ids rastreados; chaves de acesso de teste geradas aleatoriamente com DV válido; nunca alterar `tx-test-inventory@local` nem dados reais.
- CI verde: backend `npm run typecheck` = 0; frontend `npm run lint` = 0, `npm run typecheck` = 0.
- Nenhuma dependência nova (pode remover as que ficarem sem uso).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Nota com item em caixa (uCom "CX", 2 caixas de 12) → 24 unidades no pedido e no estoque, custo unitário = custo da caixa / 12 — teste em Task 3.
2. Total do pedido e das parcelas igual ao vNF da nota ao centavo, mesmo com desconto/frete/IPI rateados — teste em Task 3.
3. Mesma nota enviada de novo depois de confirmada → 409 com link para o pedido, nada duplicado; duas confirmações simultâneas → uma só — testes em Task 2 e Task 3.
4. Falha em um item na confirmação (ex.: código de barras duplicado) → nada criado (nem fornecedor, nem produtos, nem pedido) — teste em Task 3.
5. XML malicioso (DOCTYPE/entidades) ou de outro tipo → rejeitado sem ler entidades — teste em Task 1.

---

### Task 1: Backend — leitor de NF-e

**Files:**
- Create: `backend/src/modules/nfe-import/domain/NfeDocument.ts` (tipos), `backend/src/modules/nfe-import/infrastructure/parser/NfeParser.ts`, `backend/src/shared/domain/accessKey.ts` (DV da chave), fixtures XML em `backend/src/modules/nfe-import/__fixtures__/`
- Test: `backend/src/modules/nfe-import/infrastructure/parser/__tests__/NfeParser.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("nota completa: cabeçalho, emitente, 3 itens (SEM GTIN → null, IPI, ICMS-ST, desconto, frete), duplicatas e rastro")
test("custo por item em centavos e soma = vNF")
test("nota sem cobrança → installments []")
test("modelo 65, chave com DV errado, sem itens, totais que não conferem → INVALID_NFE com mensagem")
test("XML com DOCTYPE/ENTITY → INVALID_FILE_CONTENT sem expandir entidades")                    // Review Focus 5
test("dhEmi 2026-10-23T23:30:00-03:00 → issueDate 2026-10-23")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(nfe-import): NF-e 4.00 XML parser with validation`

---

### Task 2: Backend — rascunhos de importação

**Files:**
- Modify: `backend/prisma/schema.prisma` + migration (`NfeImport`, `NfeImportStatus`, `SupplierProductMapping`)
- Create: use cases Upload/List/Get/Discard, repositórios, mapper com sugestões, rotas `/nfe-imports` (multipart)
- Delete: código antigo de nfe-import e rota `POST /nfe-import` (+ deps sem uso, após grep)
- Create: `frontend/src/test/fixtures/nfe/{nfeImport,nfeImportList}.json`
- Test: `backend/src/modules/nfe-import/infrastructure/http/__tests__/nfeImports.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("POST /nfe-imports com XML válido → 201 rascunho; fornecedor encontrado por documento")
test("sugestão por mapeamento do fornecedor e, sem mapeamento, por código de barras")
test("reenviar a mesma chave em rascunho → 200 mesmo id; chave confirmada → 409 NFE_ALREADY_IMPORTED com purchaseId")  // Review Focus 3
test("PDF → 400 UNSUPPORTED_FILE_TYPE; sem arquivo → 400")
test("GET lista e detalhe; DELETE rascunho 204; DELETE confirmado 409; chaves = fixtures; VENDEDOR/ESTOQUISTA 403")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration; remover código antigo.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(nfe-import): persisted import drafts with supplier and item suggestions`

---

### Task 3: Backend — confirmação

**Files:**
- Modify: finance service (parcelas explícitas no contas a pagar da compra), casos de uso de pedido/recebimento da 6A se precisar de entrada programática
- Create: `ConfirmNfeImportUseCase`, schema, controller, rota `POST /nfe-imports/:id/confirm`
- Test: `backend/src/modules/nfe-import/infrastructure/http/__tests__/confirmNfeImport.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("confirmar com fornecedor novo cria fornecedor, produto, variante, mapeamento, pedido XML e contas a pagar com as duplicatas")
test("caixa com 12 unidades: 2 CX → 24 unidades, custo unitário = custo/24 no pedido e no estoque")         // Review Focus 1
test("total do pedido = vNF ao centavo com desconto/frete/IPI; parcelas editadas com soma divergente → 422") // Review Focus 2
test("receive true → estoque e lotes da nota; false → pedido PENDING")
test("itens da mesma variante somados num item; quantidade não inteira → 422 NFE_QUANTITY_NOT_INTEGER")
test("fornecedor existente com documento diferente → 422 SUPPLIER_DOCUMENT_MISMATCH")
test("código de barras duplicado num item → 409 e nada criado")                                          // Review Focus 4
test("duas confirmações simultâneas → uma 201 e uma 409; próxima nota do fornecedor sugere pelo mapeamento") // Review Focus 3
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; typecheck 0.**
- [ ] **Step 5: Commit** — `feat(nfe-import): confirm import into supplier, catalog, purchase, payable and stock`

---

### Task 4: Frontend — importação de NF-e

**Files:**
- Create: `frontend/src/modules/nfe-imports/**` (lista, envio, revisão), rotas e menu (Compras → Importar NF-e), handlers MSW
- Test: `frontend/src/modules/nfe-imports/pages/__tests__/{NfeImportListPage,NfeImportReviewPage}.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("enviar XML navega para a revisão; 409 NFE_ALREADY_IMPORTED mostra link para o pedido")
test("revisão: sugestões pré-selecionadas; item sem sugestão exige escolher vincular ou criar")
test("unidades por embalagem atualiza a quantidade em unidades; parcelas editáveis com soma conferida")
test("confirmar envia o corpo esperado e navega para o pedido; entrada no estoque só com purchases.receive")
test("menu: só ADMIN vê Importar NF-e")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test` 2×; lint 0; typecheck 0; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): NF-e import upload, review and confirmation`
