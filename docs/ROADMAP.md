# Roadmap

Ordem das próximas etapas, o que cada uma precisa e o que depende de você. Histórico do que já foi feito: `docs/HISTORICO.md`.

## Ordem

| # | Etapa | Plano | Tamanho | Depende de |
|---|---|---|---|---|
| 0 | Onda 9 — acabamento (em andamento) | `plans/2026-10-26-wave9-polish.md` | — | — |
| 1 | Precificação e lucro | `plans/2026-10-26-pricing.md` | 10 tarefas · médio | onda 9 mergeada (custos `Decimal(14,4)`) |
| 2 | Crediário | `plans/2026-10-26-credit.md` | 14 tarefas · grande (o maior dos três) | precificação (taxas de cartão, custo na venda) |
| 3 | Migração do caderninho | `plans/2026-10-26-notebook-import.md` | 9 tarefas · médio | crediário (perfil, limite, `noLateFees`) |
| 4 | WhatsApp fase 2 (lembrete automático) | **não planejado** | — | crediário em uso |

Dentro do crediário:
- **Multa e juros de atraso:** Task 11.
- **Revisão periódica do limite (rotina mensal `npm run credit-review`):** Task 12.
- **Pedidos de cancelamento de venda:** Tasks 1–2, sem dependência da precificação; podem começar antes.
- **WhatsApp fase 1** (link `wa.me` com o resumo): Task 13.

Paralelismo entre planos: as Tasks 1–3 do crediário (cancelamento por pedido e permissão por usuário) e a Task 2 do caderninho (nomes parecidos) não dependem das etapas anteriores.

## O que você precisa decidir ou confirmar

**Antes da precificação**
- Nada bloqueia o início. Depois de pronta, preencha na tela: margem padrão, despesas da venda (aluguel, embalagem, comissão, imposto), taxas da maquininha (débito, crédito 1x a 12x).
- Confirmar: o preço com repasse da taxa do cartão sobe só até o centavo, sem a tabela de arredondamento (decisão provisória do plano).

**Antes do crediário**
- **Bloqueia a Task 7:** com o pagamento registrado na hora, uma venda à vista não poderia mais ser cancelada. Proposta: ao cancelar, o sistema estorna sozinho o pagamento feito no fechamento; parcelas do crediário já pagas continuam bloqueando o cancelamento (decidido).
- Conferir os valores iniciais antes de **ligar** o crediário (ele nasce desligado): faixas de parcelas, parcela mínima R$ 30, taxa 3,99% a.m., perfis (Novo R$ 300, Regular R$ 800, Bom R$ 2.000, Excelente R$ 5.000) e entrada mínima.
- Aprovar os pesos da pontuação da revisão mensal antes de ligar o cron.
- Marcar na tela de usuários quem "Pode aprovar crédito".
- Preencher os dados da loja (nome, CNPJ, endereço, telefone) para o carnê.

**Antes do caderninho**
- Dívida anotada com vencimento já passado: conta como atraso (bloqueia novas compras no crediário) ou entra como "a combinar"? O plano segue a spec (conta).
- Separar o caderno e escolher como entrar: planilha, lançamento rápido no celular ou fotos para o Claude transcrever.

## Ações do operador pendentes

Do `docs/HISTORICO.md`:
1. Trocar a senha temporária do admin criada na recuperação de 2026-10-23.
2. Definir `COMPANY_CNPJ` no `backend/.env`.
3. Rodar `npm run merge-count-lots` (simulação), conferir e aplicar com `-- --apply`.
4. Testar em aparelho real (iPhone/Safari, Android/Chrome, tablet) com `npm run dev:https`.
5. Backup diário no cron: `PGCONTAINER=api_db_1 npm run backup-db`. O crediário acrescenta `npm run credit-review` mensal.
6. Produção: `NODE_ENV=production`, `CORS_ORIGINS`, `JWT_SECRET` ≥ 32, `TRUST_PROXY`, `COMPANY_CNPJ`, nginx com HTTPS.
7. Recadastrar os produtos com preço de venda.
