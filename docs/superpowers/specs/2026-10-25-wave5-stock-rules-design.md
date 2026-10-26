# Onda 5 — Regras de estoque

**Data:** 2026-10-25
**Status:** decidido pelo usuário em 2026-10-25:
- Ordem de saída: primeiro o lote mais próximo do vencimento, depois o mais antigo.
- Lote vencido não pode ser vendido.

Achados de origem em `docs/reviews/2026-10-25-revisao-geral.md` (seção "Revisão — backend/src/modules/inventory").

**Fora desta onda:** ajuste de inventário abaixo do reservado (decisão 5 pendente com o usuário).

## 1. Ordem de consumo (FEFO → mais antigo)
- Toda saída que escolhe lotes automaticamente ordena por:
  1. `expirationDate` ascendente, com os lotes sem validade por último;
  2. `createdAt` ascendente;
  3. `id`, para desempate determinístico.
- Isso vale para a venda, a saída manual sem lote e o ajuste para baixo.
- A reconciliação das caixas (alocações mais antigas primeiro) não muda.

## 2. Lote vencido não é vendido
- **Vencido:** `expirationDate` anterior à data de negócio de hoje (America/Sao_Paulo). Lote que vence hoje ainda pode ser vendido.
- **Venda (`origin SALE`):** consome só lotes não vencidos, em FEFO.
- **Estoque insuficiente na venda:** se o saldo não vencido não cobre a quantidade, a venda inteira é recusada.
  - Resposta: 409 `EXPIRED_STOCK_ONLY` quando há saldo vencido suficiente para cobrir a falta; caso contrário, 409 `INSUFFICIENT_STOCK`, como hoje.
  - Mensagem: "Estoque insuficiente para <produto/variante>: <n> disponível(is) dentro da validade; <m> vencida(s) — dê baixa manual dos vencidos."
  - Sem `<m>` quando não há vencidos.
  - A mensagem identifica o item da venda.
- **Saída manual (perda, descarte):** aceita `inventoryLotId` opcional para baixar um lote específico, inclusive vencido.
  - Valida que o lote pertence ao inventário e tem saldo.
  - Sem `inventoryLotId`, usa a ordem do §1 incluindo vencidos (os vencidos saem primeiro, porque vencem antes).
- **Leitura:** o detalhe do inventário e os saldos em lote (`GET /inventory?productVariantIds=`) passam a informar `expired`, a quantidade vencida.
  - `available` continua sendo `quantity − reserved` (mesma semântica).
  - O frontend mostra "Vencido: n" com destaque quando `expired > 0`, e na lista de lotes marca cada lote vencido com "Vencido".
  - A tela de nova venda mostra a mensagem do backend no item.

## 3. Entrada no mesmo número de lote
- Ao somar uma entrada a um lote existente (mesmo `batchNumber`), o custo do lote vira a média ponderada pela quantidade, arredondada a 2 casas, como o custo médio do inventário.
- Se a validade (ou a data de fabricação) informada for diferente da do lote, a entrada é recusada.
  - Resposta: 409 `LOT_DATES_MISMATCH`, "O lote <n> já existe com validade <dd/mm/aaaa>. Use outro número de lote ou a mesma validade."
  - Data não informada não conta como divergência.

## 4. Inventário inicial sem um lote por leitura
- Sem número de lote, as leituras da mesma variante na mesma caixa somam num único lote "aberto" da contagem, em vez de criar um lote por leitura.
- O custo médio é lido depois da trava.
- **Lote aberto:** lote MANUAL sem `batchNumber` informado pelo usuário, criado pela contagem, identificado por `batchNumber` gerado `CONT-<código da caixa>-<código da variante>`.
- Correção dos dados já existentes: script `npm run merge-count-lots`.
  - Roda em modo de simulação por padrão e só altera com `--apply`.
  - Une os lotes de contagem de 1 unidade da mesma variante e caixa, preservando as somas e as alocações.

## 5. Reserva e liberação ligadas ao documento
- A reserva grava a origem real e exige `originId`.
- A liberação exige `origin` + `originId` e não pode liberar mais do que o reservado por aquele documento (soma de RESERVE − RELEASE).
  - Resposta: 409 `RELEASE_EXCEEDS_RESERVATION`, "A liberação excede o reservado por este documento."

## 6. Correções de leitura
- Movimentações: o total respeita os mesmos filtros da listagem (`count({ where })`), sem `as any`.
- Consulta de caixa: cada item informa `quantity`, a quantidade daquele lote naquela caixa, e o `id` da alocação. O frontend mostra "Na caixa: n" (com o total do lote como informação secundária).

## Testes e aceite
Cada item com teste que falha antes.

Casos mínimos:
- **Lotes A, B e C:** A vence dia 10, B vence dia 5 e C não tem validade. A venda consome B, depois A, depois C.
- **Lote vencido:** com saldo vencido de 5 e saldo válido de 2, uma venda de 3 é recusada com `EXPIRED_STOCK_ONLY` e a mensagem; uma venda de 2 passa.
- **Saída manual:** com `inventoryLotId` vencido, baixa aquele lote.
- **Mesmo lote:** a média ponderada do custo está certa; uma validade divergente dá 409.
- **Contagem:** 3 leituras sem lote geram 1 lote de 3.
- **Script:** une os lotes antigos e é idempotente.
- **Liberação:** acima do reservado do documento dá 409.
- **Movimentações:** o total filtrado está certo.
- **Caixa:** informa a quantidade na caixa.

Aceite: CI verde; backend `npm test` 2× no banco de teste; frontend lint 0, typecheck 0, testes, build.
