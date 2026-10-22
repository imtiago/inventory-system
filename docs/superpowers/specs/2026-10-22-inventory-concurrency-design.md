# Concorrência de estoque — Design

**Data:** 2026-10-22
**Status:** desenho decidido (usuário delegou: "avalie a melhor forma e faça")
**Depende de:** TransactionManager, Estoque Fase 1, Fase 2 (erros tipados)

## Problema

Os use cases de estoque fazem ler → calcular → gravar a linha inteira dentro de
uma transação Read Committed (padrão do Postgres). Requisições simultâneas na
mesma variante leem o mesmo saldo e ambas gravam: venda dupla do mesmo estoque,
recebimentos no mesmo lote se sobrescrevendo, caixa acima do saldo do lote,
lote duplicado por variante (sem restrição única). Dados atuais verificados:
sem duplicatas de lote e sem saldos inconsistentes.

## Objetivo

Nenhuma combinação de requisições simultâneas deixa saldo, lotes ou caixas
inconsistentes. Em disputa, uma requisição espera a outra (e decide sobre o
saldo atualizado) ou é recusada com erro claro (422 estoque insuficiente /
409 `CONCURRENT_UPDATE`) — nunca as duas passam indevidamente.

## Abordagem: trava pessimista por variante

- `IInventoryRepository.lockByProductVariantId(productVariantId): Promise<Inventory>`
  — Prisma: `INSERT INTO "Inventory" (...) VALUES (...) ON CONFLICT ("productVariantId") DO NOTHING`
  (cria vazio se não existe) seguido de `SELECT ... FOR UPDATE` e mapeamento
  para o domínio. Fora de transação ativa lança `InternalInvariantError`
  (`LOCK_OUTSIDE_TRANSACTION`). A criação implícita exige variante existente:
  o use case valida a variante antes (Receive já valida via `CatalogService`).
- Para use cases que não devem criar inventário (Dispatch, Reserve, Release,
  Adjust, caixas), um segundo método
  `lockExistingByProductVariantId(productVariantId): Promise<Inventory | null>`
  (`SELECT ... FOR UPDATE` sem insert). Ausente → o use case lança o
  `NotFoundError` que já lança hoje.
- Onde trava (no início do `handle`, antes de qualquer leitura usada em
  cálculo; depois relê lotes/caixas):

| Use case | Trava |
|---|---|
| ReceiveInventory | `lockByProductVariantId` (cria se faltar) |
| DispatchInventory, ReserveInventory, AdjustInventory | `lockExistingByProductVariantId` |
| ReleaseInventory (input `inventoryId`) | carrega o inventário, trava pela variante dele |
| AddProductToBox, RemoveProductFromBox | trava a variante do lote antes de `sumAllocatedByLot`/`findStock` |
| RegisterScannedProduct | coberto pelas chamadas aninhadas (mesma transação) |
| CreateProductVariantInventory | `lockExisting…`; se existe → 409 como hoje; senão cria |

- Ordem de travas: `CreateSaleUseCase` processa itens em ordem crescente de
  `productVariantId` (sem deadlock entre vendas com itens em ordem inversa).
- `PrismaTransactionManager` executa `SET LOCAL lock_timeout = '<n>ms'` ao
  abrir a transação; `lockTimeoutMs` configurável no construtor (padrão 5000).
- Tratador de erros: deadlock e lock timeout → 409
  `{ message: "Operação em andamento para este item. Tente novamente.", code: "CONCURRENT_UPDATE" }`.
  Formas a mapear (confirmar empiricamente): Prisma `P2034`; `P2010` com
  `meta.code` `40P01` (deadlock) ou `55P03` (lock_not_available); erro bruto do
  driver com esses SQLSTATE.
- Migration: `@@unique([productVariantId, batchNumber])` em `InventoryLot`
  (NULLs continuam distintos). Duplicata → `P2002` → 409 (mapeamento existente).

## Fora de escopo

Fila/retry automático; travas em outros módulos; isolamento SERIALIZABLE;
dispatch descontar caixas (decisão da Fase 1 mantida).

## Testes e aceite

Integração real (dev DB, `Promise.all`, dados `tx-test-` rastreados):
- dois dispatch de 4 com saldo 5 → exatamente um 422 `INSUFFICIENT_STOCK`;
  saldo final 1; soma dos lotes = saldo;
- N=5 receives simultâneos de 3 no mesmo `batchNumber` → um lote com 15,
  saldo 15, 5 movimentações com saldos encadeados coerentes;
- primeiro receive simultâneo de variante nova → um inventário;
- dois AddProductToBox que juntos excedem o lote → exatamente um 422
  `BOX_LIMIT_EXCEEDED`; alocado ≤ restante;
- reserve concorrente acima do disponível → um recusado;
- trava segura a segunda transação até o commit da primeira (teste de tempo);
- `lockTimeoutMs` curto + trava segurada → 409 `CONCURRENT_UPDATE`;
- lock fora de transação → `InternalInvariantError`;
- vendas com itens em ordem inversa simultâneas → ambas concluem (ou 409),
  nunca travam; itens processados em ordem crescente (teste unitário).
Aceite: `npm test` passa 3 vezes seguidas; tsc backend ≤ 176; nenhum
`.update(` de inventário em use case sem trava prévia (revisão).
