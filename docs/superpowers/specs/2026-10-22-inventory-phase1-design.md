# Estoque — Fase 1: fluxos funcionando de ponta a ponta

**Data:** 2026-10-22
**Status:** desenho aprovado em conversa; aguardando revisão da spec
**Depende de:** `2026-10-22-transaction-manager-design.md` (implementado)

## Problema

O módulo de estoque está majoritariamente quebrado:

- `GET /inventory/:id` e `POST /inventory/lots` sempre respondem 400
  (`GetInventoryByIdFactory` injeta o repositório de escrita, sem `getById`).
- Receive / Dispatch / Reserve / Release / RegisterScannedProduct chamam
  `save()`/`findByVariant()`, inexistentes nos repositórios.
- Dados gravados errados: `averageCost` nunca é lido nem gravado; criar lote
  chama `adjust`, que **sobrescreve** o saldo; o mapper de leitura de lotes
  devolve campos inexistentes e omite `remainingQuantity`; Dispatch lê
  `lot.remainingQuantity` (a entidade expõe `availableQuantity`);
  `RemoveProductFromBox` soma; `AddProductToBox` não limita ao saldo do lote.
- Domínio × banco: `StockMovement` exige `previousQuantity`, `currentQuantity`,
  `inventoryLotId`, `averageCost` (sem colunas); `RELEASE` não existe no enum;
  mapper descarta `notes`/`originId` e quebra com `userId` nulo.
- `userId` de movimentações vem do corpo da requisição (falsificável).
- Frontend: detalhes do inventário sempre em erro; assistente de inventário
  inicial trava ao criar lote, coloca uma unidade por vez, só lista caixas que
  já têm o lote, tela em branco no passo `product-search`; `VariantStock` chama
  rota inexistente e sempre mostra "Sem estoque"; 34 erros de `tsc` nos
  arquivos de estoque; hooks/componentes mortos; sem testes.

## Objetivos

1. Toda entrada de estoque tem uma única regra (`ReceiveInventoryUseCase`).
2. Saldo, saldo por lote, custo médio e alocação em caixas ficam consistentes
   em qualquer sequência de operações.
3. Cada movimentação registra lote, saldo anterior/atual, custo médio e o
   usuário autenticado.
4. As telas existentes (lista, detalhes, coluna de estoque da variante,
   assistente de inventário inicial) funcionam contra a API real.
5. Backend e frontend de estoque cobertos por testes automatizados.

## Fora de escopo

- Telas novas (histórico de movimentações, dashboard com dados reais, telas de
  ajuste/saída/reserva) — fase própria, depois da Fase 2 (erros tipados).
- Status HTTP corretos (404/409/422) — Fase 2. Nesta fase erros seguem 400.
- Concorrência de estoque (`SELECT ... FOR UPDATE` / versão otimista).
- Integração com vendas e compras (CreateSale/CancelSale continuam como estão).
- Erros de `tsc` fora dos arquivos de estoque.

## 1. Banco de dados

Migration aditiva gerada com `prisma migrate dev` e aplicada no banco do
`DATABASE_URL` de desenvolvimento:

- `StockMovement`: novas colunas opcionais `inventoryLotId String?` (relação
  com `InventoryLot`, `onDelete: SetNull`), `previousQuantity Int?`,
  `currentQuantity Int?`, `averageCost Decimal?`.
- Enum `StockMovementType`: adiciona `RELEASE`.

Movimentações existentes ficam com as novas colunas nulas. Nenhuma coluna é
removida ou renomeada.

## 2. Domínio

### Inventory
Regras inalteradas (`receive`, `dispatch`, `reserve`, `release`, `adjust`).
Passa a ser carregado e persistido com `averageCost`.

### InventoryLot
- Propriedades alinhadas ao banco: `initialQuantity`, `remainingQuantity`
  (substituem `quantity`/`availableQuantity`).
- Métodos: `receive(quantity)` (soma em ambos), `consume(quantity)`,
  `restore(quantity)`. `addQuantity` é removido (duplicava `receive`).
- Invariantes: `initialQuantity > 0`, `0 ≤ remainingQuantity ≤ initialQuantity`,
  `unitCost ≥ 0`.

### StockMovement
- Props: `inventoryId`, `productVariantId`, `type`, `origin`, `quantity > 0`,
  `previousQuantity`, `currentQuantity`, `inventoryLotId?`, `averageCost?`,
  `originId?`, `userId?` (opcional — movimentações de sistema), `notes?`.
- Validação de coerência por tipo:
  - `IN`: `current = previous + quantity`
  - `OUT`: `current = previous − quantity`
  - `RESERVE` / `RELEASE`: `current = previous` (saldo físico não muda)
  - `ADJUSTMENT`: `quantity = |current − previous|`

### InventoryBoxStock
Sem mudança de regra (`addQuantity`, `removeQuantity` já corretos).

## 3. Repositórios (contratos de domínio)

- `IInventoryRepository`: `findById`, `findByProductVariantId`, `create`,
  `update`, `delete`.
- `IInventoryLotRepository`: `findById`, `findByProductVariantIdAndBatchNumber`,
  `findAvailableByInventory` (`remainingQuantity > 0`, `createdAt asc` — FIFO),
  `create`, `update`, `delete`. Remove `findByProductVariantId` (retornava
  `Inventory`).
- `IInventoryBoxStockRepository`: acrescenta
  `sumAllocatedByLot(inventoryLotId): Promise<number>`; `findById` retorna
  `null` quando não encontra.
- `IInventoryBoxRepository`: inalterado.
- `IStockMovementRepository`: inalterado; `create` persiste todos os campos.

Mappers Prisma corrigidos: `InventoryMapper` com `averageCost`;
`InventoryLotMapper` com os novos nomes; `StockMovementMapper` com todos os
campos e `user` conectado somente quando `userId` existe; `update` de
movimentação usa mapper de update.

## 4. Use cases

Todos estendem `TransactionalUseCase` (exceto queries).

| Use case | Regra |
|---|---|
| `ReceiveInventory` | Entrada única. Input: `productVariantId`, `quantity`, `unitCost`, `batchNumber?`, `manufacturingDate?`, `expirationDate?`, `origin`, `sourceType`, `originReferenceId?`, `notes?`, `userId?`. Cria `Inventory` se não existir (variante validada via `CatalogService`); se `batchNumber` informado e já existir lote da variante com esse número, `lot.receive(quantity)`, senão cria lote; `inventory.receive({quantity, unitCost})`; movimentação `IN` com lote e saldos. Retorna `{ inventory, lot }`. |
| `DispatchInventory` | Valida saldo disponível; consome lotes FIFO; **uma movimentação `OUT` por lote consumido**, saldos encadeados. Falha sem gravar se lotes forem insuficientes. |
| `ReserveInventory` | `inventory.reserve`; movimentação `RESERVE` (saldo inalterado). |
| `ReleaseInventory` | `inventory.release`; movimentação `RELEASE`. |
| `AdjustInventory` | Input: `productVariantId`, `countedQuantity`, `notes?`, `userId?`. Diferença 0 → nenhuma gravação, retorna `null`. Para baixo: consome lotes FIFO pela diferença. Para cima: cria lote `MANUAL` com `unitCost = averageCost` atual. `inventory.adjust`; movimentação `ADJUSTMENT`. |
| `AddProductToBox` | Não altera saldo. Recusa se `sumAllocatedByLot + quantity > lot.remainingQuantity` com mensagem `"Quantidade excede o saldo do lote disponível para caixas (X)."`. |
| `RemoveProductFromBox` | `stock.removeQuantity`. |
| `RegisterScannedProduct` | Variante por código de barras → `ReceiveInventory` (custo: `unitCost` da requisição ou `averageCost` atual) → `AddProductToBox`, na mesma transação. |
| `CreateProductVariantInventory` | Mantido (rota `POST /inventory/`): valida variante, recusa se já existir inventário, cria com saldo 0. Corrigido para estender `TransactionalUseCase` e depender de `CatalogService` (interface). |
| Removidos | `ManagerCreateInventoryLotUseCase`, `CreateInventoryLotUseCase`; factories `CreateInventoryLotFactory`/`CreateInventoryLotFactory1`, `InventoryService_1.ts`, presenters vazios, `inventorySchemas.ts` e `createStockMovementSchema.ts`. |

`InventoryApplicationService.consumeStock` (usado por vendas) passa a chamar
`DispatchInventory` com `origin: SALE`; mantém a interface `InventoryService`.

## 5. API

Rotas existentes mantidas; prefixo `/inventory`. Respostas no formato atual
(`{ data }` / `{ data, pagination }`).

| Rota | Comportamento |
|---|---|
| `GET /` | inalterado; DTO inclui `averageCost`. |
| `GET /:id` | usa `PrismaInventoryReadRepository`; DTO: `id`, `productVariantId`, `quantity`, `reservedQuantity`, `availableQuantity`, `minimumStock`, `averageCost`, `createdAt`, `productVariant {id, code, name, barcode, productId}`. |
| `GET /variants/:variantId` | mesmo DTO; 404 quando não existe (comportamento atual). |
| `GET /variants/:productVariantId/lots` | query `page`, `limit`; ordem `createdAt desc`; DTO de lote: `id`, `inventoryId`, `productVariantId`, `batchNumber`, `initialQuantity`, `remainingQuantity`, `allocatedQuantity`, `unitCost`, `sourceType`, `manufacturingDate`, `expirationDate`, `createdAt`. |
| `POST /lots` | corpo: `productVariantId`, `batchNumber`, `quantity`, `unitCost`, `expirationDate` (ISO), `manufacturingDate?` (ISO). Chama `ReceiveInventory` (`origin: INVENTORY`, `sourceType: MANUAL`). Resposta: DTO de lote. |
| `POST /receive` | corpo do `IReceiveInventoryInput` sem `userId`. |
| `POST /dispatch`, `/reserve`, `/release` | sem `userId`/`reason` no corpo. |
| `POST /adjust` | corpo: `productVariantId`, `countedQuantity`, `notes?`. |
| `POST /initial-count` | corpo: `barcode`, `boxCode`, `quantity?` (padrão 1), `batchNumber?`, `expirationDate?`, `unitCost?`. |
| `GET /boxes` | **nova**: query `search?`, `page`, `limit`; DTO de caixa `id`, `code`, `createdAt`, `updatedAt`. |
| `POST /boxes` | inalterado. |
| `POST /boxes/:id/items` | corpo `inventoryLotId`, `quantity`; aplica limite do lote. |
| `GET /boxes/by-lot`, `/boxes/code/:code`, labels | inalterados (DTO de lote embutido segue o novo formato). |

- `userId` de toda escrita vem de `request.user.sub`.
- Erro de validação Zod: status 400, `message` legível
  `"<campo>: <mensagem>"` das issues, separadas por `; `.
- O arquivo `"CreateInventoryBoxController .ts"` é renomeado (sem espaço).

## 6. Frontend

### Infra de testes
Vitest + `@testing-library/react` + `@testing-library/user-event` +
`@testing-library/jest-dom` + `jsdom` + MSW 2, em versões compatíveis com
Vite 8 / React 19. Script `"test": "vitest run"`. Setup em
`frontend/src/test/` (servidor MSW, render com `QueryClientProvider` e router).

### Fixtures de contrato
Payloads de resposta usados pelo MSW ficam em
`frontend/src/test/fixtures/inventory/*.json` (inventário, lote, caixa,
listas paginadas). Um teste de integração do backend chama a rota real e
afirma que o conjunto de chaves da resposta é igual ao da fixture
correspondente (recursivamente em objetos e no primeiro item de arrays).

### Serviços e tipos
`inventoryService` e tipos de `modules/inventory/types` espelham exatamente o
contrato da seção 5. `baseURL` vem de `import.meta.env.VITE_API_URL`
(padrão `http://localhost:3000`).

### Telas
- **Lista de inventário:** inalterada (corrige "Items (undefined)" no loading).
- **Detalhes:** saldo, reservado, disponível, custo médio; tabela de lotes
  (lote, recebido, restante, em caixas, custo, validade).
- **`VariantStock`:** usa `GET /inventory/variants/:id` e o retorno real do hook.
- **Assistente de inventário inicial** (mantém `useInitialInventoryFlow` como
  máquina de estados):
  - remove o prompt "criar inventário" (o recebimento cria);
  - lote criado é o retornado pela API e fica selecionado; lista mostra
    `remainingQuantity` e `allocatedQuantity`;
  - passo caixa: busca qualquer caixa por código (`GET /boxes?search`), cria
    nova, informa quantidade (1 … `remainingQuantity − allocatedQuantity`),
    botão "Voltar" para o lote;
  - fechar o modal de busca de produto volta ao passo anterior;
  - sem código de barras: após escolher o produto, lista as variantes para
    escolher existente ou criar nova;
  - erro de rede/servidor na busca por código de barras mostra o erro (não
    entra no fluxo "não encontrado");
  - mensagem final: `"<N> unidade(s) colocada(s) na caixa <código>."`;
  - campo de quantidade de etiquetas pode ser apagado durante a digitação;
    valida no envio.
- Toda mutação de estoque invalida as query keys de inventário, lotes e caixas.

### Limpeza
Removidos: `useCreateInventoryLot1`, `useInventoryByVariant`,
`useInitialInventory`, `useRegisterScannedProduct` (o assistente não usa `initial-count`; a rota continua no backend),
`InitialInventoryLotSelection`, `InitialInventoryNewLot`,
`InitialInventoryProductSelectionModal`, `InitialInventoryProductNotFound`,
`ProductFoundCard`, `ProductNotFoundModal`, `services/initialInventoryService.ts`,
`pages/StockEntryPage.tsx`, `config/messages.ts` e `config/queryKeys.ts`
copiados de produtos, `console.log` de depuração.
`useInventoryLots`/`useInventoryLotsByVariant` unificados em um hook.

## 7. Testes e critérios de aceite

**Backend** (`node:test` via `npm test`):
- Unitários das entidades (`InventoryLot`, `StockMovement` — coerência por tipo).
- Use cases com repositórios em memória: Receive (novo lote, lote existente,
  custo médio, cria inventário), Dispatch (FIFO multi-lote, saldo
  insuficiente), Reserve/Release, Adjust (0, para cima, para baixo),
  AddProductToBox (limite do lote), RemoveProductFromBox, RegisterScanned.
- Integração contra o banco: Receive + Dispatch persistem saldos, lotes e
  movimentações coerentes; falha no meio não grava nada; contrato de chaves
  das rotas vs fixtures do frontend.

**Frontend** (`npm test` → Vitest):
- `inventoryService` contra MSW (paths, corpo, mapeamento).
- `InventoryDetailsPage` renderiza saldo e lotes.
- `VariantStock` mostra disponível e "Sem estoque".
- Assistente: caminho feliz com leitura de código (variante encontrada → lote
  novo → caixa existente → quantidade N → mensagem final); erro de servidor na
  leitura; limite de quantidade na caixa; voltar da caixa para o lote; fechar
  modal de busca não deixa tela vazia.

**Aceite:**
- `cd backend && npm test` e `cd frontend && npm test` passam.
- `npx tsc -b` no frontend: zero erros em `src/modules/inventory/**`,
  `src/modules/products/components/VariantStock.tsx` e
  `src/shared/services/api.ts`; total ≤ 77 − 34.
- `npx tsc --noEmit` no backend: nenhum erro novo; zero erros em
  `src/modules/inventory/**`.
- `vite build` passa.
- Roteiro manual do assistente executado contra a API real com o banco de
  desenvolvimento (passos da seção 6) — resultados reportados.
