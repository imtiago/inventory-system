# Precificação e visibilidade de lucro (Bloco A)

**Data:** 2026-10-26
**Status:** proposta para revisão do usuário.

Decisões do usuário em 2026-10-26:
- O preço base nasce do custo de aquisição do lote, somado aos outros custos e à margem desejada.
- O custo usado é o **custo médio** do estoque. Além dele existe um campo com o **preço sugerido pelo fornecedor** (o preço de revista da Natura e do Boticário).
- Quando o custo muda, o sistema **sugere** o preço novo e ela confirma.
- Todos os outros custos são permitidos: frete, aluguel, embalagem, comissão e impostos.
- O arredondamento fica a critério da implementação.
- Ela aceita cartão de débito e de crédito. Na hora da venda escolhe se repassa a taxa ao cliente; na maioria das vezes repassa.

O crediário (Blocos B a D) e o caderninho (Bloco E) terão desenho próprio. Este documento cria a base de preço que eles vão usar.

## 1. Conceitos
- **Custo de aquisição do lote:** preço unitário pago, mais a parte de cada unidade nos custos da compra.
  - Custos da compra: frete, seguro, outras despesas, IPI e ICMS-ST.
  - Na NF-e, vêm dos campos do item (`vFrete`, `vSeg`, `vOutro`, `vIPI`, `vST`).
  - Na entrada manual ou no pedido de compra, são um valor total opcional de "frete/despesas da compra", dividido entre os itens proporcionalmente ao valor de cada um.
- **Custo médio:** média ponderada do custo de aquisição, mantida no estoque como já é hoje. Passa a incluir os custos da compra.
- **Despesas da venda (%):** percentuais aplicados sobre o preço de venda, cadastrados pela loja. Exemplos:
  - aluguel e contas;
  - embalagem;
  - comissão;
  - imposto (Simples Nacional).
  - Para despesas fixas mensais existe um **ajudante**: ela informa o valor mensal (R$) e o faturamento médio mensal, e o sistema calcula o percentual.
- **Margem desejada (%):** sobre o preço de venda.
  - Há um valor padrão da loja, que pode ser substituído por categoria, por produto e por variante. Vale o mais específico.
- **Preço sugerido:** `custo médio ÷ (1 − Σ despesas% − margem%)`, arredondado.
  - Se `Σ despesas% + margem% ≥ 100%`, a configuração é recusada com a mensagem "Despesas e margem somam 100% ou mais".
- **Preço base de venda:** o `salePrice` atual da variante, que é o preço à vista.
  - Hoje é digitado à mão. Passa a ter a sugestão ao lado e a margem real calculada.
- **Preço do fornecedor (revista):** `supplierSuggestedPrice`, opcional, por variante, com a data de atualização.
  - A tela mostra a margem que ela teria vendendo pelo preço da revista.
  - Há um botão "usar preço da revista".

## 2. Arredondamento (estratégia escolhida)
Sempre **para cima**, para nunca ficar abaixo do mínimo calculado:

| Faixa do preço | Termina em | Exemplos |
|---|---|---|
| Abaixo de R$ 10 | ,90 ou ,50 | 7,30 → 7,50; 7,60 → 7,90 |
| De R$ 10 a 99,99 | ,90 | 38,18 → 38,90 |
| De R$ 100 a 999,99 | 9,90 | 132,10 → 139,90 |
| A partir de R$ 1.000 | 9,00 | 1.203 → 1.209 |

A estratégia é configurável: ",90", ",99", "inteiro" ou "sem arredondamento". O padrão é a da tabela acima.

## 3. Cartão
- **Taxas na configuração:**
  - débito (%);
  - crédito à vista (%);
  - crédito parcelado de 2x a 12x (% para cada número de parcelas).
- **Repasse ao cliente:** o preço é ajustado por `preço ÷ (1 − taxa%)`, para que ela receba o preço base líquido. Sem repasse, a taxa sai da margem.
- **Uso:** o cálculo fica pronto como serviço, com testes. A escolha da forma de pagamento na venda entra na etapa do crediário, que redesenha o fechamento da venda.
- **Simulador:** na tela do produto, para ela ver o preço e a margem em cada forma de pagamento.

## 4. Telas
### Configurações de preço (só ADMIN, nova permissão `pricing.manage`)
- **Despesas da venda:** lista com nome e %, com o ajudante "valor mensal ÷ faturamento".
- **Margem padrão (%)**.
- **Estratégia de arredondamento**.
- **Taxas de cartão**.
- **Limite de alerta:** a partir de quantos pontos de margem abaixo da desejada um preço entra na revisão (padrão: 2 pontos).

### Margem por categoria e produto
- Campo opcional "Margem desejada (%)" no cadastro de categoria, produto e variante.

### Variante
- **Composição do preço:**
  - custo médio;
  - despesas (R$ e %);
  - margem desejada;
  - preço sugerido;
  - preço praticado;
  - margem real (R$ e %);
  - preço da revista e a margem pela revista.
- **Botões:** "Aplicar sugerido" e "Usar preço da revista". Só para quem tem `catalog.price`.
- **Simulador por forma de pagamento:** à vista, débito, crédito 1x e crédito parcelado, mostrando preço e margem.

### Preços para revisar
Uma lista nova no menu Catálogo. Uma variante entra nela quando:
- o custo médio muda numa entrada de estoque, recebimento de compra ou NF-e;
- a configuração ou a margem muda;
- a margem real fica abaixo da desejada além do limite de alerta.

Para cada variante a lista mostra o preço atual, o sugerido, a diferença e o motivo, com as ações:
- **aplicar sugerido**, numa variante ou em várias selecionadas;
- **manter**, que tira o item da lista até o próximo gatilho;
- **editar**.

Também há um contador no menu e no dashboard.

**Regra de entrada (decisão do plano, Task 5):** com a configuração salva, a cada gatilho calcula-se o sugerido (custo médio atual) e a margem real ao preço praticado. Margem real < margem desejada − limite de alerta → motivo `MARGIN_BELOW_TARGET` (vence os demais); senão, sugerido ≠ preço → motivo do gatilho (`COST_CHANGED`, `SETTINGS_CHANGED` para configuração/despesas, `MARGIN_CHANGED` para margem de categoria/produto/variante); senão a variante sai da lista (pendente antiga é removida). Sem custo ou sem configuração → nada. Uma pendente por variante (índice único parcial). "Aplicar" usa o sugerido recalculado na hora; editar o preço da variante resolve a pendente como aplicada; "manter" vale até o próximo gatilho.

## 5. Lucro
- **Custo na venda:** cada `SaleItem` passa a gravar `unitCost`, o custo médio da variante no momento da venda. Assim o lucro de vendas passadas não muda quando o custo mudar.
  - Vendas antigas ficam sem custo e aparecem como "custo não registrado".
- **Relatório de lucro:**
  - **Visões:** por período, por venda, por produto ou variante e por categoria.
  - **Colunas:** receita, custo, despesas estimadas (os percentuais aplicados na receita), lucro e margem.
  - **Filtros:** período (data de negócio) e vendedor.
  - **Exportação:** CSV no padrão dos outros relatórios.
- **Dashboard:** cartão "Lucro do mês" e "Margem média do mês", visível só para ADMIN.

## 6. Dados (migrations aditivas)
- `PricingSettings`: linha única com margem padrão, estratégia de arredondamento, limite de alerta e as taxas de cartão em JSON validado.
- `PricingExpense`: id, nome, percentual, ativo e ordem.
- `marginPercent` opcional em `Category`, `Product` e `ProductVariant`.
- `supplierSuggestedPrice` (`Decimal(12,2)`) e `supplierSuggestedPriceUpdatedAt` em `ProductVariant`.
- Custo de aquisição do lote: `InventoryLot.unitCost` passa a ser o custo de aquisição completo, e os custos da compra ficam registrados separadamente no lote (`acquisitionExtraCost` unitário) para auditoria.
- `PriceReview`: variante, motivo, preço atual, preço sugerido, situação (`PENDING`, `APPLIED` ou `DISMISSED`), criação e resolução. Só uma pendente por variante.
- `SaleItem.unitCost` (`Decimal(14,4)`, opcional).
- Percentuais em basis points (inteiros), com o mesmo cuidado de centavos inteiros usado para dinheiro.

## 7. Permissões
- `pricing.manage`, só ADMIN: configurações, despesas e margens.
- `catalog.price`, já existente e só ADMIN: aplicar preço.
- `reports.profit`, só ADMIN: relatório de lucro e cartões do dashboard.

## Testes e aceite
- **Fórmula e arredondamento:** tabela de casos.
- **Rateio dos custos da compra:**
  - na NF-e com frete e IPI;
  - na entrada manual com despesa total.
- **Custo médio com custo completo.**
- **Prioridade da margem:** a da variante vale sobre a do produto, que vale sobre a da categoria, que vale sobre a da loja.
- **Limite das despesas:** soma de 100% ou mais é recusada.
- **Gatilhos da revisão de preço.**
- **Ações da revisão:** aplicar, aplicar em lote, manter e permissão.
- **Cartão:** cálculo com e sem repasse.
- **Venda:** `unitCost` gravado na venda.
- **Relatório de lucro:** com vendas antigas sem custo.
- **Permissões.**
- **Frontend:** telas no celular e no desktop, nos dois temas.

Aceite: CI verde e QA visual.
