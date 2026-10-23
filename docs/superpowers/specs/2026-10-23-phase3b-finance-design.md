# Fase 3B — Financeiro (contas a receber)

**Data:** 2026-10-23
**Status:** decidido (usuário delegou as decisões: "pode seguir", mantendo a abordagem da 3A)
**Depende de:** Fase 3A (vendas geram `FinancialDocument` RECEIVABLE com parcelas; cancelamento trava o documento com `FOR UPDATE`)

## Problema

- Não existe caso de uso nem rota para registrar pagamento; `Payment` existe só no banco/domínio.
- Status do documento nunca é atualizado (fica `OPEN`).
- `FinancialDocumentReadMapper` marca parcela que vence hoje como `OVERDUE` (compara meia-noite UTC com agora) e soma dinheiro em float; `dueDate` sai como timestamp.
- `GET /receivables` sem nome do cliente, sem filtros, ordenado por criação.
- Nenhuma tela de financeiro.
- Contas a pagar depende do módulo de compras (fora de escopo).

## Objetivos

1. Registrar pagamentos (parciais ou totais) e estornos com trilha de auditoria.
2. Status de parcela e documento sempre corretos; "vencida" pela data de negócio (America/Sao_Paulo).
3. Pagamento e cancelamento de venda nunca correm juntos.
4. Telas para acompanhar e baixar contas a receber.

## Fora de escopo

Contas a pagar; juros/multa/desconto; conciliação bancária; lançamentos manuais de contas a receber; renegociação de parcelas.

## 1. Banco (migration aditiva)

`Payment`: `createdById String?` (FK users, SetNull), `reversedAt DateTime?`, `reversedById String?` (FK users, SetNull), `reversalReason String?`. Relações nomeadas em `User` (`paymentsCreated`, `paymentsReversed`).

## 2. Domínio (finance)

- Dinheiro em centavos (`@shared/domain/money`): entidades guardam `amountCents`.
- `Payment`: `amountCents > 0`, `method`, `paymentDate` (date-only), `reference?`, `createdById?`, `reversedAt?`, `reversedById?`, `reversalReason?`; `reverse(userId, reason)` — já estornado → `ConflictError PAYMENT_ALREADY_REVERSED`.
- `FinancialParcel`: `paidCents` = soma de pagamentos **não estornados**; `remainingCents`; `status(today)`: `PAID` se pago ≥ valor; `PARTIALLY_PAID` se > 0; `OVERDUE` se `dueDate < today` (comparação de datas `YYYY-MM-DD`); senão `OPEN`. Documento `CANCELED` → todas as parcelas `CANCELED`.
- `FinancialDocument.recalculateStatus()`: `CANCELED` mantém; senão `PAID` se todas pagas; `PARTIALLY_PAID` se algum pagamento ativo; senão `OPEN`. Persistido.
- "Hoje" = `todayInBusinessTz()` (`backend/src/shared/domain/businessDate.ts`).

## 3. Casos de uso

| Use case | Regra |
|---|---|
| `RegisterPaymentUseCase` | input `{ documentId, parcelId, amount, method, paymentDate?, reference?, userId }`. Trava o documento (`FOR UPDATE`, mesmo método do cancelamento). Documento inexistente → 404 `FINANCIAL_DOCUMENT_NOT_FOUND`; parcela não pertence ao documento → 404 `PARCEL_NOT_FOUND`; documento `CANCELED` → 409 `FINANCIAL_DOCUMENT_CANCELED`; `amount` > restante → 422 `PAYMENT_EXCEEDS_REMAINING`; `paymentDate` padrão = hoje (negócio), não pode ser futura → 400. Grava pagamento, recalcula e grava status do documento. |
| `ReversePaymentUseCase` | input `{ paymentId, reason, userId }`. Trava o documento da parcela do pagamento. Inexistente → 404 `PAYMENT_NOT_FOUND`; já estornado → 409; documento `CANCELED` → 409 `FINANCIAL_DOCUMENT_CANCELED`. Marca estorno, recalcula e grava status. |

`reason`: obrigatório, 3–200 caracteres.

## 4. API

Prefixo `/receivables` (papéis `admin`, `vendedor`), respostas `{ data }` / `{ data, pagination }`.

| Rota | Comportamento |
|---|---|
| `GET /receivables` | query: `page`, `limit` (≤ 100), `status` (`OPEN`,`PARTIALLY_PAID`,`PAID`,`OVERDUE`,`CANCELED`), `customerId`, `dueFrom`, `dueTo` (`YYYY-MM-DD`, filtram documentos com alguma parcela no intervalo). `status=OVERDUE` = documentos não cancelados com parcela vencida em aberto. Ordenação: próximo vencimento em aberto ascendente; pagos/cancelados por último. Resposta inclui `summary: { openAmount, overdueAmount, receivedAmount }` (sobre o filtro, sem paginação; `receivedAmount` = pagamentos ativos). |
| `GET /receivables/:id` | detalhe |
| `POST /receivables/:id/parcels/:parcelId/payments` | corpo `{ amount, method, paymentDate?, reference? }` → `201 { data: ReceivableDetailDTO }` |
| `POST /receivables/payments/:paymentId/reverse` | corpo `{ reason }` → `200 { data: ReceivableDetailDTO }` |

DTOs (valores monetários number com 2 casas, datas de vencimento/pagamento `YYYY-MM-DD`):
```
ReceivableListItemDTO { id, status, displayStatus, originType, originId, customer: { id, name },
  totalAmount, paidAmount, remainingAmount, nextDueDate: string | null, parcelsCount, createdAt }
ReceivableDetailDTO { id, status, displayStatus, originType, originId, customer: { id, name }, createdAt,
  totalAmount, paidAmount, remainingAmount,
  parcels: [{ id, number, amount, dueDate, paidAmount, remainingAmount, status,
    payments: [{ id, amount, method, paymentDate, reference, createdAt, createdBy: { id, name } | null,
      reversedAt, reversedBy: { id, name } | null, reversalReason }] }] }
```
`displayStatus` = `status` do documento, exceto `OVERDUE` quando não cancelado/pago e há parcela vencida. `number` = posição da parcela por vencimento (1..n). Pagamentos estornados aparecem com `reversedAt` preenchido e não contam em `paidAmount`.
Mapper de leitura reescrito em centavos e com a regra de "hoje" de negócio; o detalhe da venda (`SaleDetailDTO.receivable`) usa a mesma regra de status de parcela.

## 5. Frontend

- Menu: grupo "Financeiro" → "Contas a receber" (`/receivables`).
- Lista: filtros (status, cliente — autocomplete existente, vencimento de/até), cards de resumo (Em aberto, Vencido, Recebido), tabela (cliente, origem com link para a venda, total, pago, restante, próximo vencimento, status), paginação.
- Detalhe `/receivables/:id`: cabeçalho com status e totais; parcelas com status; por parcela: pagamentos (incluindo estornados riscados com motivo) e botão "Registrar pagamento" (desabilitado se paga ou documento cancelado).
- Modal "Registrar pagamento": valor (padrão = restante; ≤ restante), forma (Dinheiro, PIX, Transferência, Cartão de crédito, Cartão de débito, Boleto), data (padrão hoje local; não futura), referência opcional; erro do backend no campo/alerta, uma vez.
- "Estornar" por pagamento ativo: modal com motivo obrigatório.
- Venda: detalhe da venda mostra link "Ver contas a receber"; detalhe do recebível linka a venda de origem.
- Dinheiro em centavos; datas `YYYY-MM-DD` via `formatDateOnly`.

## 6. Testes e aceite

Backend: status de parcela/documento (hoje não vencida; ontem vencida; estornado não conta); registrar pagamento (parcial, total → documento PAID, excedente 422, documento cancelado 409, parcela de outro documento 404, data futura 400, `createdById` do token); estorno (status recalculado, duplo estorno 409, motivo obrigatório); concorrência (pagamento × cancelamento da venda simultâneos → exatamente um conclui; dois pagamentos que juntos excedem → um 422); lista (filtros, OVERDUE, ordenação, summary); contrato por fixtures `frontend/src/test/fixtures/finance/{receivableList,receivableDetail}.json`.
Frontend: lista com filtros e resumo; detalhe; registrar pagamento (corpo enviado, validações, erro uma vez); estorno; links venda ↔ recebível; item de menu.
Aceite: backend `npm test` 3×, tsc ≤ 145; frontend `npm test`, `tsc -b` ≤ 30, `vite build`.
