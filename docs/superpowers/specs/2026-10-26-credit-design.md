# Crediário — crédito interno (Blocos B, C e D)

**Data:** 2026-10-26
**Status:** proposta para revisão do usuário. Os números são **valores iniciais** e todos ficam configuráveis por ela.
**Depende de:** precificação (`2026-10-26-pricing-design.md`) — o preço base à vista e as taxas de cartão vêm de lá.

## Requisitos do usuário (2026-10-26)
- **Hoje:**
  - não há entrada, nem máximo ou mínimo de parcelas;
  - não há multa nem juros de atraso;
  - ela só anota em caderno.
- **Primeira compra:** exige entrada mínima, aceita poucas parcelas e o crédito é pequeno. Isso deve ser ajustável, porque há clientes antigos muito bons.
- **Parcelas:** o máximo depende do valor da compra; é preciso achar um equilíbrio.
- **Limite de crédito:**
  - é calculado pelo sistema;
  - sobe ou desce com o tempo, conforme o relacionamento com o cliente;
  - aumentos podem ser pedidos e só **usuários específicos** aprovam;
  - para clientes muito bons, a aprovação pode ser automática.
- **Carnê:** um carnê impresso agora; envio por WhatsApp no futuro.

## 1. Fechamento da venda (nova tela de pagamento)
A venda passa a ter **uma condição de pagamento**, escolhida no fim:

| Condição | Preço | Financeiro |
|---|---|---|
| Dinheiro / PIX | preço base (à vista) | recebido na hora (pagamento registrado na venda) |
| Débito | base; com repasse: base ÷ (1 − taxa) | recebido na hora |
| Crédito 1x–12x | base; com repasse: base ÷ (1 − taxa da quantidade de parcelas) | recebido na hora (a maquininha cuida do parcelamento) |
| **Crediário** | base + acréscimo do plano (§2) | contas a receber com as parcelas; entrada opcional ou obrigatória, paga em dinheiro, PIX ou cartão |

- **Repasse da taxa do cartão:** é um botão na venda, ligado por padrão, com o valor final na tela.
- **Margem na venda:** a margem da venda inteira em cada condição aparece só para ADMIN.
- **Pagamento à vista:** registra o pagamento na mesma transação da venda, com idempotência. A venda à vista não gera conta em aberto.
- **Vendas parceladas antigas:** a venda parcelada sem crediário ("até 12x sem juros" de hoje) é substituída pelo crediário. Vendas antigas continuam como estão.

## 2. Regras do crediário (configuração da loja)
- **Faixas de valor → máximo de parcelas** (valor financiado, depois da entrada):

  | Valor financiado | Parcelas |
  |---|---|
  | até R$ 150 | até 2x |
  | até R$ 300 | até 3x |
  | até R$ 600 | até 5x |
  | até R$ 1.000 | até 8x |
  | acima | até 10x |

- **Parcela mínima:** R$ 30.
- **Sem acréscimo até:** 2 parcelas. Acima disso, **taxa mensal de 3,99%** pela Tabela Price, com parcelas iguais; o acréscimo é aplicado sobre o valor financiado.
- **Vencimentos:**
  - primeiro vencimento em 30 dias;
  - ela pode escolher o **dia do vencimento**, de 1 a 28;
  - os demais vencem mensalmente.
- **Bloqueio por atraso:** nova compra no crediário fica bloqueada se o cliente tiver parcela vencida há mais de 10 dias. Para comprar assim, a venda precisa de autorização (§4).
- **Simulação na venda:** uma tabela com todas as quantidades permitidas, mostrando para cada uma:
  - entrada;
  - valor da parcela;
  - total a prazo;
  - acréscimo em R$ e em %;
  - margem, só para ADMIN.

## 3. Perfil e limite de crédito do cliente
- **Perfis**, com valores iniciais:

  | Perfil | Limite inicial | Entrada mínima | Máx. parcelas | Observação |
  |---|---|---|---|---|
  | Novo | R$ 300 | 30% | 3 | todo cliente sem histórico |
  | Regular | R$ 800 | 15% | 5 | |
  | Bom | R$ 2.000 | 0% | 8 | |
  | Excelente | R$ 5.000 | 0% | 10 | candidato a aumento automático |

  O máximo de parcelas da venda é o **menor** entre o do perfil e o da faixa de valor.
- **Ficha de crédito do cliente:**
  - perfil, limite atual e **disponível** (limite − saldo devedor em aberto, incluindo o saldo do caderninho);
  - situação: ativo, bloqueado ou suspenso;
  - histórico de mudanças: de quanto para quanto, motivo, quem fez ou se foi automático, e quando.
- **Ajuste manual:** ela coloca os clientes antigos e bons direto em "Bom" ou "Excelente", inclusive na migração do caderninho.

## 4. Autorizações, pedidos de aumento e "usuários específicos"
- **Permissão por usuário:** cada usuário ganha a opção **"Pode aprovar crédito"** na tela de usuários.
  - Hoje as permissões são por papel; esta é a primeira por usuário.
  - O ADMIN sempre pode aprovar.
  - Nova permissão lógica `credit.approve` = ADMIN ou usuário marcado.
- **Pedido de aumento de limite:**
  - qualquer vendedor cria, informando o cliente, o valor pedido e o motivo;
  - fica numa lista "Pedidos de crédito" para quem pode aprovar, que aprova (podendo ajustar o valor) ou recusa com motivo;
  - tudo vai para o histórico.
- **Aprovação automática:** acontece quando o perfil é Bom ou Excelente e, juntando:
  - nenhum atraso acima de 5 dias nos últimos 12 meses;
  - pelo menos 6 parcelas pagas;
  - pedido de até 50% acima do limite atual.
- **Venda acima do limite ou com atraso:** só passa com autorização na hora, dada por alguém com `credit.approve`.
  - A pessoa autoriza com a própria senha na tela da venda, com motivo.
  - Fica registrado na venda.

## 5. Revisão periódica do limite (rotina)
- **Quando roda:**
  - script `npm run credit-review`, mensal no cron, junto do backup;
  - botão "Rodar revisão agora" para ADMIN;
  - o resultado aparece na tela antes de aplicar e, no cron, é aplicado direto.
- **Pontuação do cliente nos últimos 12 meses:**
  - **ganha pontos com:**
    - parcelas pagas em dia;
    - meses de relacionamento;
    - total pago;
  - **perde pontos com:**
    - dias de atraso;
    - parcelas pagas com mais de 30 dias de atraso;
    - renegociações.
- **Regras iniciais:**
  - **sobe** um perfil, com o limite inicial do novo perfil, se a pontuação passar do patamar e não houver atraso aberto;
  - **desce** um perfil se houver atraso acima de 30 dias no período;
  - **suspende** se houver parcela vencida há mais de 60 dias.
  - Baixar o limite não mexe na dívida existente, só bloqueia compras novas.
- **Transparência:** cada mudança vai para o histórico com o motivo, por exemplo "subiu para Bom: 9 parcelas em dia, 0 atrasos".

## 6. Atraso: multa e juros (só para vendas novas no crediário)
- **Valores:**
  - multa de **2%**, o máximo permitido pelo CDC, art. 52 §1º;
  - juros de mora de **1% ao mês**, proporcionais aos dias;
  - carência de **3 dias**.
  - Tudo é configurável, mas a multa nunca passa de 2%.
- **Cálculo:**
  - feito no recebimento: valor devido = restante da parcela + multa + juros até a data do pagamento (data de negócio);
  - o pagamento grava a divisão principal / multa / juros.
- **Dispensa:** quem tem `credit.approve` pode dispensar, total ou parcialmente, com motivo registrado.
- **Exceções:**
  - dívidas do caderninho e vendas anteriores ao crediário **não** têm multa nem juros (marca `noLateFees`);
  - essas dívidas continuam a contar no limite.

## 7. Carnê, recibo e WhatsApp
- **Carnê PDF por venda:**
  - **dados da loja:** nome, CNPJ, endereço e telefone (nova "Dados da loja" nas configurações);
  - **dados do cliente e da venda;**
  - **resumo exigido em venda a prazo:**
    - preço à vista;
    - entrada;
    - valor financiado;
    - número e valor das parcelas;
    - taxa mensal e acréscimo total;
    - total a prazo;
    - multa e juros por atraso;
  - **canhotos:** um por parcela, com número, vencimento, valor e espaço para assinatura. Formato A4 com 3 canhotos por página. O formato bobina fica para depois.
- **Recibo PDF:** emitido a cada pagamento.
- **WhatsApp, fase 1:** botão "Enviar pelo WhatsApp" que abre o WhatsApp (link `wa.me`) com o resumo e as parcelas em texto. Sem API e sem custo.
- **WhatsApp, fase 2 (futura, fora deste desenho):** envio automático de lembrete de vencimento.

## 8. Dados (resumo)
- **Configurações:**
  - `CreditSettings`: linha única com faixas, parcela mínima, parcelas sem acréscimo, taxa, dia de vencimento padrão, bloqueio por atraso, multa, juros, carência e critérios de aprovação automática;
  - `StoreSettings`: dados da loja.
- **Perfis e ficha do cliente:**
  - `CreditProfile`: os perfis e seus parâmetros;
  - em `Customer`: `creditProfileId`, `creditLimit`, `creditStatus`;
  - `CreditLimitChange`: o histórico.
- **Pedidos e permissão:**
  - `CreditLimitRequest`: pedidos;
  - `User.canApproveCredit`.
- **Venda:**
  - `Sale` ganha `paymentCondition`, `cardFeePassedOn`, `downPayment`;
  - `SaleFinancing`: o snapshot do plano (preço à vista, taxa, parcelas, acréscimo e autorização de exceção).
- **Pagamentos e documentos:**
  - `Payment` ganha `fineAmount`, `interestAmount`, `waivedAmount`, `waiverReason`;
  - `FinancialDocument.noLateFees`.

## 9. Permissões
| Permissão | Quem | O que permite |
|---|---|---|
| `credit.manage` | ADMIN | Configurações, perfis e ajuste manual de perfil e limite |
| `credit.approve` | ADMIN ou usuário marcado | Aprovar pedidos, autorizar exceção na venda, dispensar multa e juros |
| `credit.request` | VENDEDOR, ADMIN | Pedir aumento |
| `sales.create` | Já existente | Venda no crediário, dentro das regras |

## 10. Decidido pelo usuário (2026-10-26)
- **Cancelamento de venda:** o VENDEDOR não cancela mais direto. Ele **pede o cancelamento**, com motivo, e um ADMIN aprova ou recusa.
  - Pedido de cancelamento no mesmo molde do pedido de aumento de limite: situação `PENDING`, `APPROVED` ou `REJECTED`; quem pediu, quem decidiu, motivo do pedido, motivo da recusa e datas.
  - Aprovar executa o cancelamento de hoje (estoque devolvido, contas a receber cancelado, mesmas travas e bloqueios). Recusar só registra o motivo.
  - Permissões: `sales.cancel.request` (VENDEDOR e ADMIN) para pedir; `sales.cancel` passa a ser só ADMIN (aprovar, recusar e cancelar direto).
  - Lista "Pedidos de cancelamento" para o ADMIN, com contador no menu.
- **Cancelamento de venda no crediário com parcelas pagas:** continua como hoje — bloqueado (`SALE_HAS_PAYMENTS`).
- **Cancelamento de venda paga no ato (à vista, cartão e entrada do crediário):** o cancelamento aprovado estorna automaticamente os pagamentos feitos no fechamento (`Payment.atCheckout`), **somente até 7 dias corridos depois da venda** (data de negócio). Depois disso → 409 `CHECKOUT_REFUND_WINDOW_EXPIRED` "Venda paga no ato só pode ser cancelada com estorno em até 7 dias.". Interpretação registrada de "o estorno é feito em até 7 dias" (2026-10-26).
- **Dívidas do caderninho:** contam no saldo devedor e no limite, mas **não** bloqueiam o cliente por atraso e **não** pioram perfil nem pontuação (nem as vencidas). Decidido em 2026-10-26.
- **Ativação do crediário:** nasce desligado com os valores iniciais já preenchidos. O ADMIN ativa em Configurações de crédito depois de conferir; a ativação exige dados da loja preenchidos (para o carnê) e ao menos um aprovador de crédito, e registra quem e quando ativou. A rotina mensal de revisão de limite fica desligada no cron até os pesos serem aprovados (dá para rodar manualmente com prévia). Precificação: sem preço sugerido até a configuração de preço ser salva. Decidido pelo Claude a pedido do usuário ("da melhor forma").

## 11. Valores iniciais
Faixas, perfis, taxa de 3,99% ao mês e pesos da revisão são valores iniciais; a usuária confere e ajusta antes de ativar (§10).

## Testes e aceite
Cada regra com teste que falha antes:
- **Tabela Price:** casos com centavos e ajuste da última parcela.
- **Valor e parcelas:** faixas, perfil e parcela mínima.
- **Bloqueios e exceções:** limite e atraso, e a autorização de exceção.
- **Perfis e pedidos:** subir e descer perfil na revisão, e aprovação automática.
- **Atraso:** multa e juros (pró-rata, carência, dispensa e `noLateFees`).
- **Documentos:** carnê e recibo (conteúdo do resumo legal).
- **Venda à vista e cartão:** com e sem repasse.
- **Concorrência:** duas vendas simultâneas não estouram o limite (trava na ficha do cliente).
- **Permissões:** por papel e por usuário.
- **Telas:** no celular e no desktop, nos dois temas.
