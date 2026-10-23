# Fase 8 — Dashboard

**Data:** 2026-10-23
**Status:** decidido (usuário delegou: "faça o que precisar ser feito")

## Problema
A rota `/` mostra uma página vazia. Não há visão rápida de vendas, contas vencendo, estoque zerado ou lotes vencendo.

## Backend — `GET /dashboard` (permissão `self`; cada seção só vem se o usuário tiver a permissão dela)
Resposta `{ data: DashboardDTO }`, valores monetários em reais (2 casas), datas `YYYY-MM-DD` no fuso de Brasília, tudo calculado em SQL (agregações no banco, sem carregar listas na memória):
```
DashboardDTO {
  generatedAt,
  sales?:      { today: { count, total }, month: { count, total },             // sales.read; vendas não canceladas
                 last7Days: [{ date, count, total }] (7 itens, dias sem venda com 0),
                 topVariants: [{ productVariantId, label, quantity, total }] (5, mês corrente) },
  receivables?: { open, overdue, dueNext7Days: { count, amount } },          // finance.read; restante a receber
  payables?:    { open, overdue, dueNext7Days: { count, amount } },          // payables.read
  inventory?:   { outOfStockCount, outOfStock: [{ productVariantId, label, quantity }] (10, quantity ≤ 0 entre variantes com estoque registrado),
                  expiringLots: { count, items: [{ lotId, batchNumber, label, expirationDate, remainingQuantity }] (5, vencendo em até 30 dias, remainingQuantity > 0, ordenado por validade) } },  // inventory.read
  purchases?:   { awaitingReceipt: { count, total } }                         // purchases.read; PENDING + PARTIALLY_RECEIVED
}
```
- "Hoje", "mês corrente" e "próximos 7 dias" pela data de negócio (`todayInBusinessTz`); `overdue` = parcelas não pagas com vencimento < hoje; `open` = restante de documentos não cancelados.
- Uma consulta por seção (ou poucas), em paralelo; meta: resposta < 300 ms com 10 mil vendas (não precisa de teste de carga, mas nada de N+1).

## Frontend
- `DashboardPage` com cartões por seção, exibidos conforme a permissão (o backend já omite):
  - Vendas: hoje e mês (quantidade e valor), gráfico de barras dos últimos 7 dias (SVG/CSS próprio, sem dependência nova; rótulos e valores acessíveis; tema claro/escuro já usado no app), top 5 variantes.
  - Contas a receber / a pagar: em aberto, vencido (destaque), vencendo em 7 dias — cada número linka para a lista filtrada (`/receivables?status=OVERDUE`, etc.; usar os filtros já existentes da lista).
  - Estoque: quantidade de variantes sem estoque (lista das 10) e lotes vencendo em 30 dias (lista das 5), com link para o estoque/produto.
  - Compras: pedidos aguardando recebimento (link `/purchases?status=PENDING`).
- Estados de carregamento e erro; atualização ao voltar à aba (padrão do React Query).

## Testes e aceite
Backend: cada seção com dados controlados (vendas de hoje, de ontem e canceladas; parcelas vencidas, vencendo e pagas; estoque zerado; lote vencendo e vencido; pedidos pendentes) — valores exatos; dias sem venda com zero; seções omitidas por papel (VENDEDOR sem payables/purchases; ESTOQUISTA só inventory e purchases); data de negócio na virada do dia (23h30 em Brasília conta como hoje). Isolamento: como os dados do banco de dev são compartilhados por testes paralelos, os testes comparam **deltas** (antes/depois de criar os dados do teste) ou filtram por ids criados — nunca valores absolutos globais.
Frontend: cartões por papel, links com filtros, gráfico com 7 barras e rótulos, estado de erro.
Aceite: CI verde.
