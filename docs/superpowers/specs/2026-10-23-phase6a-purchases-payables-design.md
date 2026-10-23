# Fase 6A — Fornecedores, compras com recebimento e contas a pagar

**Data:** 2026-10-23
**Status:** decidido (usuário aprovou a divisão 6A/6B e delegou as decisões: "pode seguir")
**Depende de:** estoque (lotes, `ReceiveInventoryUseCase`, trava por variante), 3B (financeiro, pagamentos e estornos), 4A (permissões), 5 (CI)

## Problema
- Entrada de mercadoria só existe como "receber estoque" manual, sem origem financeira nem fornecedor.
- O banco já tem `Supplier`, `Purchase`, `PurchaseItem` (com `receivedQuantity`), `PurchaseStatus` (`PENDING`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELED`), `InventoryLot.purchaseItemId`, `FinancialType.PAYABLE`, `FinancialPartyType.SUPPLIER`, `FinancialOriginType.PURCHASE`, `StockMovementOrigin.PURCHASE` — sem casos de uso, rotas nem telas (a camada de aplicação antiga foi removida na fase 5; o domínio de `purchases` existe e pode ser reaproveitado ou reescrito).

## Fora de escopo
Importação de NF-e (6B); edição de pedido (cancelar e criar outro); devolução ao fornecedor; cancelar pedido já recebido; impostos detalhados; múltiplos depósitos.

## Permissões novas (estendem a matriz da 4A)
| Permissão | ADMIN | VENDEDOR | ESTOQUISTA |
|---|---|---|---|
| `purchases.read` (fornecedores e pedidos) | ✅ | | ✅ |
| `purchases.write` (criar/editar fornecedor, criar/cancelar pedido) | ✅ | | |
| `purchases.receive` (registrar recebimento) | ✅ | | ✅ |
| `payables.read`, `payables.pay`, `payables.reverse` | ✅ | | |
Excluir fornecedor: `purchases.write`.

## Backend

### Dinheiro e datas
Centavos inteiros (`@shared/domain/money`); `purchaseDate` e vencimentos `YYYY-MM-DD`; "hoje" = `todayInBusinessTz()`.

### Fornecedores — `/suppliers`
`SupplierDTO { id, name, document, documentType: "CPF"|"CNPJ", email, phone, createdAt }`
- `document`: só dígitos; 11 (CPF) ou 14 (CNPJ) com dígitos verificadores válidos → senão 400; único → 409 `SUPPLIER_DOCUMENT_ALREADY_EXISTS` ("Já existe um fornecedor com esse documento.").
- `name` normalizado (trim, colapsa espaços), 2–120, caixa preservada; `email` (trim, minúsculas, válido) e `phone` (dígitos, 10–11) opcionais (ausente, `null` ou `""` → null).
- `GET /suppliers` (`page`, `limit` ≤ 100, `search`: nome, documento — dígitos —, e-mail) · `GET /suppliers/:id` (404 `SUPPLIER_NOT_FOUND`) · `POST` → 201 · `PATCH` parcial (≥1 campo; só colunas enviadas) · `DELETE` → com pedidos → 409 `SUPPLIER_IN_USE`, senão 204.

### Pedidos de compra — `/purchases`
```
PurchaseDTO { id, code, status, supplier: {id,name}, purchaseDate, notes, totalAmount, createdAt,
  items: [{ id, productVariant: {id,name,code,barcode}, quantity, receivedQuantity, remainingQuantity,
            unitPrice, discount, freight, tax, total, unitCost }],
  payable: { id, status, displayStatus, parcels: [{ id, number, amount, dueDate, paidAmount, remainingAmount, status }] } | null }
PurchaseListItemDTO { id, code, status, supplier: {id,name}, purchaseDate, totalAmount, itemsCount, receivedPercent, createdAt }
```
- `code`: gerador de numeração, faixa `PURCHASE`, prefixo `"PC"` (adicionar ao enum `NumberRangeName`; a faixa é criada sob demanda).
  Se `Purchase` não tiver coluna `code`, migration aditiva `code String @unique` (preencher existentes — banco atual: verificar; se houver linhas, gerar códigos na migration).
- `POST /purchases` (`purchases.write`): `{ supplierId, purchaseDate? (padrão hoje, não futura), notes? (≤500), items: [{ productVariantId, quantity int ≥1, unitPrice ≥0 (2 casas), discount? ≥0, freight? ≥0, tax? ≥0 }] (1..200, variantes distintas), paymentTerms: { installments 1..12, firstDueDate? } }`.
  - Item: `total = quantity×unitPrice − discount + freight + tax` (centavos), `total ≥ 0` senão 422 `INVALID_ITEM_TOTAL`; `unitCost = round(total / quantity)` (centavos) — custo que entra no estoque.
  - `totalAmount = Σ total`; deve ser > 0 → senão 422 `PURCHASE_TOTAL_ZERO`.
  - Fornecedor inexistente → 404; variante inexistente → 404 `VARIANT_NOT_FOUND`.
  - Cria, na mesma transação, o contas a pagar: `FinancialDocument { type PAYABLE, originType PURCHASE, originId purchase.id, partyType SUPPLIER, partyId supplierId }` com parcelas do mesmo `buildInstallments` das vendas (`firstDueDate` obrigatório se `installments > 1`; padrão = `purchaseDate` quando 1; não pode ser anterior a `purchaseDate` → 400).
  - Status inicial `PENDING`, origem `MANUAL`. → 201 `{ data: PurchaseDTO }`.
- `GET /purchases` (`purchases.read`): `page`, `limit`, `status`, `supplierId`, `from`/`to` (`purchaseDate`), `search` (código); ordenado por `purchaseDate` desc, `createdAt` desc.
- `GET /purchases/:id` → 404 `PURCHASE_NOT_FOUND`.
- `POST /purchases/:id/cancel` (`purchases.write`), `{ reason (3–200) }`: trava o pedido (`FOR UPDATE`) e depois o documento; já cancelado → 409 `PURCHASE_ALREADY_CANCELED`; com qualquer quantidade recebida → 409 `PURCHASE_HAS_RECEIPTS` ("Pedido com recebimentos não pode ser cancelado."); contas a pagar com pagamento ativo → 409 `PURCHASE_HAS_PAYMENTS`; senão pedido `CANCELED` (guardar motivo — coluna `cancelReason String?` + `canceledAt DateTime?` se não existirem) e documento `CANCELED`. → 200 `{ data }`.

### Recebimento — `POST /purchases/:id/receipts` (`purchases.receive`)
`{ items: [{ purchaseItemId, quantity int ≥1, batchNumber? (trim, ≤60), manufacturingDate?, expirationDate? }] (≥1, itens distintos) }`
- Trava o pedido (`FOR UPDATE`); `CANCELED` → 409 `PURCHASE_CANCELED`; `RECEIVED` → 409 `PURCHASE_ALREADY_RECEIVED`; item de outro pedido → 404 `PURCHASE_ITEM_NOT_FOUND`; `quantity > remaining` → 422 `RECEIPT_EXCEEDS_REMAINING`.
- Para cada item, **em ordem crescente de `productVariantId`** (mesma ordem de trava das vendas): entrada de estoque pelo serviço de inventário (novo método `receivePurchaseStock` no `InventoryService`, reaproveitando `ReceiveInventoryUseCase`) com `sourceType PURCHASE`, `originId = purchase.id`, `purchaseItemId`, `unitCost = item.unitCost`, lote/validade; movimentação `IN` origem `PURCHASE`; soma em `receivedQuantity`.
- Status: todos recebidos → `RECEIVED`; algum > 0 → `PARTIALLY_RECEIVED`. Tudo numa transação. → 201 `{ data: PurchaseDTO }`.
- `userId` da movimentação = usuário do token.

### Contas a pagar — `/payables`
Espelho de `/receivables` (3B), generalizando os casos de uso e o repositório de leitura por `FinancialType`:
- `GET /payables` (`payables.read`): mesmos filtros (`status` incl. `OVERDUE`, `dueFrom`/`dueTo`), `supplierId` no lugar de `customerId`, `summary { openAmount, overdueAmount, paidAmount }`; item `{ ..., supplier: {id,name}, originType, originId, purchaseCode }`.
- `GET /payables/:id`, `POST /payables/:id/parcels/:parcelId/payments` (`payables.pay`), `POST /payables/payments/:paymentId/reverse` (`payables.reverse`) — mesmas regras, trava e códigos de erro da 3B.
- Um recebível nunca aparece em `/payables` e vice-versa (rotas de recebíveis passam a filtrar `type RECEIVABLE` explicitamente; pagar um recebível pela rota de payables → 404).

## Frontend
- Espelho de permissões atualizado (mesmas chaves).
- Menu: grupo **Compras** (Fornecedores, Pedidos de compra — `purchases.read`); grupo **Financeiro** ganha "Contas a pagar" (`payables.read`).
- **Fornecedores:** lista com busca, criar/editar em modal (máscara de CPF/CNPJ e telefone na exibição; envia dígitos), excluir com confirmação e 409.
- **Pedidos de compra:**
  - lista com filtros (status, fornecedor, período, código) e progresso de recebimento;
  - novo pedido: fornecedor (autocomplete), data, itens (busca de variante como nas vendas; quantidade, preço unitário, desconto, frete, imposto; total por item e geral em centavos), condição de pagamento com prévia das parcelas (mesma função das vendas), observações;
  - detalhe: itens com recebido/restante, contas a pagar com parcelas (link para o detalhe em Contas a pagar), botões "Registrar recebimento" (`purchases.receive`; modal com quantidade por item — padrão = restante —, lote e validade opcionais) e "Cancelar pedido" (`purchases.write`; motivo obrigatório; mensagens dos 409).
- **Contas a pagar:** lista e detalhe reaproveitando os componentes de Contas a receber (generalizar por tipo em vez de copiar), com fornecedor no lugar de cliente e link para o pedido; pagar (`payables.pay`) e estornar (`payables.reverse`).
- Erros exibidos uma vez; fixtures de contrato em `frontend/src/test/fixtures/purchases/{supplier,supplierList,purchaseDetail,purchaseList}.json` e `frontend/src/test/fixtures/finance/{payableList,payableDetail}.json`.

## Testes e aceite
Backend: documento CPF/CNPJ (válido, inválido, duplicado); fornecedor CRUD e 409 em uso; criação de pedido (totais em centavos, `unitCost`, parcelas somam o total, contas a pagar criado com fornecedor, data futura 400, variante repetida 400); recebimento parcial e total (estoque e custo médio atualizados, lote ligado ao item, movimentação PURCHASE com usuário, status), excedente 422, pedido cancelado 409, dois recebimentos simultâneos que juntos excedem → um 422; cancelamento (sem recebimento ok; com recebimento 409; com pagamento 409; simultâneo com recebimento → exatamente um conclui); payables (lista/resumo/filtros, pagar, estornar, isolamento de tipo nos dois sentidos); matriz de permissões das rotas novas; `routeGate` verde; contratos por fixtures.
Frontend: fornecedores (CRUD, 409), novo pedido (corpo enviado, totais, prévia de parcelas), detalhe (recebimento parcial envia corpo correto, cancelar com motivo, botões por permissão), contas a pagar (lista, pagar, estornar), menus por papel.
Aceite: CI verde (backend typecheck 0 + testes; frontend lint 0, typecheck 0, testes, build); backend `npm test` 3× local.
