# Fase 9 — Filtro "com saldo" e exportação CSV

**Data:** 2026-10-24
**Status:** decidido (usuário: "pode continuar" sobre a sugestão de filtro com saldo e relatórios exportáveis)

## Problema
- O cartão "Vencendo em 7 dias" do dashboard conta parcelas com saldo, mas o link abre a lista com documentos já pagos que tenham parcela no período; "Em aberto" abre a lista inteira (inclui pagos e cancelados).
- Não há como levar os dados para planilha (contador, conferência, backup operacional).

## 1. Filtro "com saldo" nas listas financeiras
- `GET /receivables` e `GET /payables` aceitam `openOnly=true`: só documentos não cancelados com **saldo > 0** (Σ parcelas − pagamentos ativos).
- Com `dueFrom`/`dueTo` + `openOnly=true`: o documento precisa ter **uma parcela com saldo > 0** dentro do intervalo (mesma regra do cartão do dashboard). Sem `openOnly`, o comportamento atual não muda.
- O `summary` da lista respeita o filtro.
- Frontend: caixa "Somente com saldo" nas listas de contas a receber e a pagar (lida/gravada na URL como `openOnly=true`); links do dashboard: "Em aberto" → `?openOnly=true`, "Vencendo em 7 dias" → `?openOnly=true&dueFrom=…&dueTo=…`, "Vencido" continua `?status=OVERDUE`. O número do cartão e a quantidade de documentos da lista passam a ser coerentes (o cartão conta parcelas; a lista mostra os documentos dessas parcelas — o texto do cartão diz "N parcelas").

## 2. Exportação CSV
Rotas (mesma permissão de leitura da lista correspondente; mesmos filtros da lista, sem paginação):
| Rota | Permissão | Colunas |
|---|---|---|
| `GET /reports/sales.csv?from&to&status` | `sales.read` | Código/Id da venda, Data, Cliente, Status, Itens, Total |
| `GET /reports/sale-items.csv?from&to` | `sales.read` | Venda, Data, Cliente, Produto, Variante, Código, Quantidade, Preço unitário, Total |
| `GET /reports/stock.csv` | `inventory.read` | Produto, Variante, Código, Código de barras, Quantidade, Reservado, Disponível, Custo médio, Valor em estoque |
| `GET /reports/receivables.csv?(filtros da lista)` | `finance.read` | Documento, Cliente, Origem, Parcela, Vencimento, Valor, Pago, Saldo, Status |
| `GET /reports/payables.csv?(filtros da lista)` | `payables.read` | Documento, Fornecedor, Pedido, Parcela, Vencimento, Valor, Pago, Saldo, Status |
- Formato para Excel em português: UTF-8 com BOM, separador `;`, decimal com vírgula e sem separador de milhar (`1234,50`), datas `dd/mm/aaaa` (data de negócio), cabeçalho na primeira linha, aspas duplas quando o campo tiver `;`, aspas ou quebra de linha (aspas internas duplicadas).
- **Proteção contra injeção de fórmula:** campos de texto que começam com `=`, `+`, `-`, `@`, tab ou CR recebem um `'` na frente.
- `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="vendas-AAAA-MM-DD.csv"` (nome por relatório).
- Limite de 50.000 linhas; acima → 422 `EXPORT_TOO_LARGE` ("Muitos registros para exportar. Refine os filtros."). Período de vendas obrigatório e de no máximo 366 dias → 400.
- Leitura em SQL (sem N+1), linhas montadas em streaming ou em lote único (até o limite).

## Frontend
- Botão "Exportar CSV" nas listas de vendas, estoque, contas a receber e contas a pagar (e "Exportar itens" na de vendas), visível conforme a permissão, usando os filtros atuais da tela; download via `api` com o token (blob → link temporário), nome do arquivo do `Content-Disposition`; erro (422/400) mostrado uma vez; botão desabilitado durante o download.

## Testes e aceite
Backend: `openOnly` (pago some; parcial fica; cancelado some; com intervalo só conta parcela com saldo no intervalo; summary coerente) nas duas listas; cada CSV com cabeçalho e linhas esperadas para dados do teste (filtrando pelos ids criados ou por período isolado), BOM, `;`, vírgula decimal, datas dd/mm/aaaa, escape de `;`/aspas/quebra de linha, injeção de fórmula neutralizada, limite → 422, período inválido → 400, permissões (403 por papel).
Frontend: caixa "Somente com saldo" envia `openOnly=true` e lê da URL; links do dashboard; botões de exportar enviam os filtros atuais, aparecem por permissão e mostram erro uma vez.
Aceite: CI verde.
