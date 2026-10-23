# Fase 3A — Venda correta de ponta a ponta

**Data:** 2026-10-22
**Status:** decidido (usuário delegou: "faça da forma que achar melhor seguindo as melhores práticas")
**Depende de:** Estoque Fase 1, Fase 2 (erros tipados), Concorrência de estoque

## Problema

- `ProductVariant` não tem coluna de preço: `salePrice` existe só na entidade; a venda usa `variant.salePrice` → total indefinido.
- `CreateSaleUseCase` cria o contas a receber com `totalAmount: 500` fixo e `parcels: []` (documento com total 0); não passa `originId` ao `consumeStock`.
- Schema exige `sellerId` no corpo (não gravado — sem coluna); `discount`/`notes` aceitos e ignorados.
- `SaleReadMapper` lê `item.price` (inexistente) → `unitPrice`/`totalPrice` vazios; `productVariant` não preenchido.
- Respostas de `POST /sales` e `GET /sales/:id` sem envelope `{ data }`; `customer_id` snake_case; `items: []`.
- Cancelamento: sem rota; ajusta estoque sem trava nem movimentação; enum de domínio `CANCELLED` vs banco `CANCELED`; não cancela o financeiro.
- `POST /receivables` quebrado (cliente = id da venda; sem `originId`).
- Frontend: total do carrinho sempre 0; input de quantidade trava ao apagar; erro e sucesso exibidos em dobro; link para `/sales/:id` inexistente; código morto.
- Banco atual: 0 vendas, 0 documentos financeiros (sem migração de dados).

## Objetivos

1. Toda variante tem preço de venda cadastrável; vendas usam o preço do servidor.
2. Toda venda gera contas a receber com parcelas que somam exatamente o total.
3. Cancelar uma venda devolve o estoque aos lotes de origem e cancela o financeiro, atomicamente.
4. Contrato da API de vendas consistente com o resto (`{ data }`, camelCase).
5. Telas de venda mostram preços e totais reais; existe tela de detalhe com cancelamento.

## Fora de escopo

Registro de pagamento e telas de financeiro (Fase 3B); contas a pagar (fase de compras); descontos; observações; devolução parcial.

## 1. Banco (migration aditiva)

- `ProductVariant.salePrice Decimal @default(0)` (12,2 implícito Prisma Decimal).
- `Sale.sellerId String?` com relação opcional para `User` (`onDelete: SetNull`).
- Enum `SaleStatus` do Prisma já tem `CANCELED`; o domínio passa a usar `CANCELED` (remove `CANCELLED`).

## 2. Dinheiro

- Cálculos monetários em **centavos inteiros** (`shared/domain/money.ts`: `toCents(n: number): number`, `fromCents(c: number): number`). Persistência continua `Decimal`; leitura converte com `Number()`.
- Total da venda = Σ(`quantity × unitPriceCents`).

## 3. Preço da variante

- Entidade `ProductVariant` já valida `salePrice ≥ 0`; mapper Prisma passa a ler/gravar.
- `POST /products/:id/variants` e o update de variante aceitam `salePrice` (número ≥ 0, 2 casas).
- DTOs de leitura de variante incluem `salePrice: number`.
- Venda de variante com `salePrice` 0 → 422 `BusinessRuleError("Variante sem preço de venda.", "VARIANT_WITHOUT_PRICE")`.

## 4. Criação da venda

Corpo de `POST /sales`:
```
{ customerId: uuid,
  items: [{ productVariantId: uuid, quantity: int > 0 }] (min 1, variantes distintas),
  paymentTerms: { installments: int 1..12, firstDueDate?: "YYYY-MM-DD" } }
```
- `sellerId` vem de `request.user.sub` (removido do corpo). `discount`/`notes` removidos.
- `firstDueDate` obrigatório quando `installments > 1`; quando 1 e ausente = data de hoje (UTC). Não pode ser anterior a hoje → 400.
- Plano de parcelas (`sales/domain/services/InstallmentPlan.ts`, função pura
  `buildInstallments(totalCents, installments, firstDueDate): { amountCents, dueDate }[]`):
  valor = `floor(total / n)` em cada parcela; a última recebe o resto (soma exata).
  Vencimentos mensais no mesmo dia do mês da primeira; em meses sem esse dia, o último dia do mês.
- Fluxo numa transação: valida cliente → resolve variantes (preço > 0) → monta itens com snapshot (nome, código, código de barras, preço) → consome estoque em ordem de variante passando `originId = sale.id` → grava venda (`status COMPLETED`, `sellerId`, `totalAmount`) → `FinancialService.createSaleReceivable({ saleId, customerId, parcels })`.
- `FinancialService` (interface) passa a ter tipos corretos:
  `createSaleReceivable(input: { saleId; customerId; parcels: { amount: number; dueDate: Date }[] }): Promise<void>` e
  `cancelSaleReceivable(saleId: string): Promise<void>`.
- Resposta `201 { data: SaleDetailDTO }`.

## 5. Leitura

`SaleDetailDTO`:
```
{ id, status, totalAmount, createdAt,
  customer: { id, name }, seller: { id, name } | null,
  items: [{ id, productVariant: { id, name, code, barcode }, quantity, unitPrice, totalPrice }],
  receivable: { id, status, parcels: [{ id, amount, dueDate, paidAmount, remainingAmount, status }] } | null }
```
`SaleListItemDTO` (lista): `{ id, status, totalAmount, createdAt, customer: { id, name }, itemsCount }`.
`GET /sales` → `{ data, pagination }`; `GET /sales/:id` → `{ data }` (404 `SALE_NOT_FOUND`). Parcelas de documento `CANCELED` aparecem com status `CANCELED`.

## 6. Cancelamento

`POST /sales/:id/cancel` (papéis `admin`, `vendedor`) → `200 { data: SaleDetailDTO }`. Numa transação:
1. Venda inexistente → 404; já `CANCELED` → 409 `SALE_ALREADY_CANCELED`.
2. Financeiro: se o documento da venda tem algum pagamento → 409 `SALE_HAS_PAYMENTS` ("Venda com pagamentos registrados não pode ser cancelada."); senão documento → `CANCELED`.
3. Estoque: `InventoryService.returnSaleStock(saleId)` — novo `ReturnSaleStockUseCase` no inventory: busca as movimentações `OUT` com `origin SALE` e `originId = saleId`; trava as variantes em ordem crescente; para cada movimentação: `lot.restore(q)`, `inventory.receive({ quantity: q, unitCost: lot.unitCost })`, movimentação `IN` com `origin RETURN`, `originId = saleId`, `inventoryLotId` do lote, saldos encadeados.
4. Venda → `CANCELED`.
Cancelamentos simultâneos da mesma venda: a venda é lida com trava (`SELECT … FOR UPDATE` na linha da venda via repositório `lockById`) → o segundo recebe 409.

## 7. Financeiro (limpeza mínima)

- `POST /receivables` removido (quebrado, sem uso). `GET /receivables` mantido.
- `CreateReceivableUseCase` passa a receber `originId` correto e criar documento + parcelas; reutilizado por `createSaleReceivable`.

## 8. Frontend

- `VariantForm`: campo "Preço de venda" (R$, obrigatório ≥ 0); listagem de variantes mostra o preço.
- Carrinho: `unitPrice` vem da variante (`salePrice`); total exibido = Σ (em centavos); aviso "preços zerados" removido; variante sem preço mostra alerta e bloqueia o envio.
- Quantidade: campo aceita apagar durante a digitação, valida no blur/envio (inteiro ≥ 1).
- Condição de pagamento: "À vista" ou "Parcelado" com nº de parcelas (2–12) e 1º vencimento (date, padrão hoje + 30 dias); prévia das parcelas calculada com a mesma regra (função pura compartilhada no front, testada).
- Mensagens: erro só uma vez (tela trata → sem toast do hook; `useCreateSale` passa `onError` próprio); sucesso só o toast.
- `saleService` com envelope `{ data }`; tipos espelham §5.
- Nova rota `/sales/:id` (`SaleDetailPage`): cliente, vendedor, itens, total, parcelas com status, botão "Cancelar venda" com confirmação; após cancelar, status atualizado e lista invalidada.
- Lista: link correto para o detalhe; botão/link HTML válido.
- Remover: `SalesPage.tsx`, `SalesScanPage.tsx`, `components/Cart.tsx`, `components/ProductList.tsx`, `hooks/useProducts.ts` (do módulo sales), bloco comentado do `saleService`, chaves de mensagens sem uso.

## 9. Testes e aceite

Backend: `buildInstallments` (1x, 3x com resto, dia 31 → fevereiro, soma exata); `toCents`; criação de venda (total certo, parcelas somam, `sellerId` do token, preço 0 → 422, `firstDueDate` faltando com 3x → 400, estoque consumido com `originId`); leitura (DTO exato; fixtures de contrato `frontend/src/test/fixtures/sales/{saleDetail,saleList}.json` comparadas por chaves); cancelamento (estoque volta aos lotes originais com movimentações `RETURN`, documento `CANCELED`, 2º cancelamento 409, cancelamentos simultâneos → um 409, venda com pagamento → 409 `SALE_HAS_PAYMENTS`); `POST /receivables` → 404.
Frontend: preço no `VariantForm`; carrinho com total real; prévia de parcelas; envio com `paymentTerms`; quantidade apagável; erro exibido uma vez; detalhe da venda; cancelar com confirmação.
Aceite: suítes passam (backend 3×); tsc backend ≤ 176, frontend ≤ 43; `vite build` ok.
