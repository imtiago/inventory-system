# Histórico do projeto

Resumo cronológico do que foi feito, das decisões tomadas e do que ficou pendente. Convenções e comandos: `CLAUDE.md` na raiz. Detalhes de cada etapa: `docs/superpowers/specs/` (desenho) e `docs/superpowers/plans/` (plano), com o mesmo prefixo de data.

## Antes do trabalho estruturado (mar–out/2026)

- **2026-03-12 a 03-25:** criação do repositório, diagramas (`docs/diagrams/system-design.drawio`), primeiros módulos (catálogo, estoque, vendas, clientes, contas) e frontend inicial; padronização DDD de entidades e value objects.
- **2026-07-17 a 10-22:** dezenas de commits "update core" (reestruturação em Clean Architecture, mappers, paginação, clientes). Ao fim, muitos fluxos estavam quebrados (rotas que sempre respondiam 400/500, venda com total fixo, NF-e em memória, `POST /users` público).

## Fase de reconstrução (2026-10-22 a 10-24)

Cada item: spec + plano + branch com merge `--no-ff` na `main`.

| Data | Etapa | O que entregou | Decisões principais |
|---|---|---|---|
| 10-22 | TransactionManager | `PrismaTransactionManager` com `AsyncLocalStorage`; use cases sem parâmetro `tx`; repositórios via `getDb()`; aninhados entram na transação externa | Uma só interface/implementação de transação |
| 10-22 | Estoque fase 1 | Histórico de movimentações, `ReceiveInventoryUseCase` como entrada única, despacho/reserva/ajuste por contagem, caixas limitadas ao saldo do lote, assistente de inventário inicial funcionando; Vitest + MSW no front | Inventário só muda por casos de uso de estoque |
| 10-22 | Fase 2: erros tipados | Erros de domínio com código, `errorHandler` central, `parseInput`, Zod em PT, `JWT_SECRET` obrigatório; fixtures de contrato de erro compartilhadas com o front; parse único de erro no front | 4xx/5xx corretos; 500 só para invariante interna |
| 10-22 | Concorrência de estoque | `FOR UPDATE` por variante, `lock_timeout`, 409 em deadlock/timeout, itens da venda em ordem de variante | Trava pessimista em vez de versão otimista |
| 10-22 | Fase 3A: vendas | Preço na variante (`Decimal(12,2)`), venda precificada no servidor, parcelas a receber, cancelamento devolvendo aos lotes de origem e custo médio | Servidor calcula preço; dinheiro em centavos |
| 10-23 | Fase 3B: financeiro | Pagamento e estorno com trava do documento, status por centavos e data de negócio, lista/detalhe de contas a receber | Fuso de negócio America/Sao_Paulo |
| 10-23 | Fase 4A: autenticação | JWT estrito, sessão conferida no banco, login com limite, `create-admin`, matriz de permissões em todas as rotas, gestão de usuários, troca de senha, menu e rotas por permissão | Matriz ADMIN/VENDEDOR/ESTOQUISTA aprovada pelo usuário |
| 10-23 | Fase 4B: catálogo e clientes | Edição de produto, marcas/categorias com nome único sem caixa, exclusões seguras, busca, edição parcial de cliente | — |
| 10-23 | Fase 5: tipos e CI | Zero erros de tipo/lint, código morto removido, faixas de numeração sob demanda, GitHub Actions | Suíte precisa rodar em banco vazio |
| 10-23 | Fase 6A: compras | Fornecedores, pedidos de compra com contas a pagar, recebimento em lotes, contas a pagar com as mesmas regras do receber | Recebimento usa a mesma ordem de trava da venda |
| 10-23 | Fase 6B: NF-e | Parser NF-e 4.00, rascunho persistido com sugestões, confirmação numa transação (fornecedor, catálogo, pedido, pagar, estoque), mapeamento fornecedor→variante | Divisão 6A/6B aprovada |
| 10-23 | Fase 7: idempotência | `Idempotency-Key` obrigatório nas operações de dinheiro/estoque, registro na mesma transação; front reaproveita a chave nas novas tentativas | Padrão Stripe |
| 10-23 | Fase 8: dashboard | `GET /dashboard` agregado em SQL por permissão; tela com vendas, financeiro, estoque e compras | — |
| 10-24 | Fase 9: filtros e CSV | Filtro "com saldo" (`openOnly`) e exportações CSV de vendas, estoque e financeiro | — |

**Incidente 2026-10-23 (fase 6A):** um subagente rodou `prisma migrate diff --from-migrations --shadow-database-url <dev>` e o banco de dev foi apagado (sem backup). Recuperação: migrations reaplicadas e admin recriado com senha temporária. Origem das regras absolutas do banco no `CLAUDE.md`, do banco de testes separado e do script de backup.

## Revisão geral e ondas de endurecimento (2026-10-25 a 10-26)

**2026-10-25:** revisão geral do código (`docs/reviews/2026-10-25-revisao-geral.md`): 11 Altos, 49 Médios, 63 Baixos. Depois: auditoria mobile (`2026-10-25-auditoria-mobile.md`), situação após a onda 3 (`2026-10-25-pendencias-apos-onda3.md`) e auditoria de UI desktop (`2026-10-25-auditoria-desktop-ui.md`).

| Data | Onda | O que entregou | Decisões |
|---|---|---|---|
| 10-25 | 1 — Integridade | Troca de senha derruba tokens (`passwordChangedAt`); origens manuais restritas em `/receive` e `/dispatch`; limite de etiquetas; tetos de valor; invariante das caixas + rota de remover + `fix-box-stock`; banco `inventory_test` com guarda; `backup-db`/`restore-db` | Testes nunca no banco de dev |
| 10-25 | 2 — Telas | Formulários sem clique duplo, selects pesquisáveis, assistente sem corrida, estoque em lote, filtro de período, invalidações entre módulos, modais acessíveis, 403 global, cache limpo no login | — |
| 10-25 | 3 — Produção | Build `tsup`, shutdown gracioso, `/health`, rate limit, helmet, CORS estrito, `TRUST_PROXY`, índices, listas/resumo/export financeiros em SQL, code splitting no front | — |
| 10-25 | 4 — Celular e tablet | Gaveta de menu, páginas rolando, listas em cartões, leitor de código de barras (HTTPS, câmera traseira, lanterna, leitura contínua, digitação), `MoneyInput`/`QuantityInput`, etiquetas/CSV no iOS, app instalável; depois `dev` HTTP e `dev:https` para celular, HSTS só em produção | Requisito do usuário: celular e tablet são obrigatórios |
| 10-25 | 5 — Regras de estoque | FEFO → mais antigo; vencido não vende (`EXPIRED_STOCK_ONLY`); custo ponderado no mesmo lote, `LOT_DATES_MISMATCH`; um lote por contagem (`merge-count-lots`), chaveado pela validade; reserva/liberação por documento; total de movimentações e quantidade na caixa | Usuário escolheu "bloquear a venda" de vencidos |
| 10-25/26 | 6 — UI desktop e temas | Modais em portal, variantes de botão, tokens de cor, temas claro/escuro/sistema, todas as telas migradas, lint contra cor crua, larguras máximas e cabeçalhos padronizados, foco visível | Padrão: seguir o sistema |
| 10-26 | 7 — Regras de negócio | `catalog.price` só ADMIN; CPF/CNPJ único opcional; NF-e só compra autorizada para `COMPANY_CNPJ`; tolerância de R$ 0,05; desfazer NF-e (`purchases.revert`); ajuste abaixo do reservado recusado; `nItem`, lotes repetidos e mapeamentos corrigidos | 6 recomendações aprovadas pelo usuário ("ok! pode seguir") |
| 10-26 | 8 — Integridade e segurança | CHECKs de estoque/valores e único parcial de origem financeira; README "Banco legado"; barcode ≤ 64 e conflito correto; edição sem atualização perdida (back grava só o alterado, front envia só o alterado); resumo financeiro respeita vencimento; CSV de itens vendidos corrigido; login com limites por IP+e-mail/conta/IP; sessão sincronizada entre abas | Token continua em `localStorage` (cookie httpOnly exige CSRF e mudança de deploy) |

Ao fim da onda 8 (merge `fb58ec3`, CI verde): backend 674 testes, frontend 657, lint/tipos/build limpos. **Todos os 11 Altos e os 49 Médios da revisão geral estão resolvidos.**

## Pendências

### Baixos da revisão geral ainda abertos (cerca de 50)
Lista por área em `docs/reviews/2026-10-25-pendencias-apos-onda3.md` (seção "Baixos"). Resolvidos depois daquele documento: variante "Padrão" com preço 0 (onda 7), cliente sem documento fiscal (onda 7), testes no banco de dev (onda 1). Continuam abertos, entre outros:
- Backend comum: senhas > 72 bytes truncadas pelo bcrypt; replay de idempotência sem cabeçalhos originais; `onDelete: Cascade` em histórico financeiro; custo `Decimal` sem escala; dependências mortas e CI sem checagem de drift do schema; seed grava clientes fictícios em qualquer banco.
- Catálogo/clientes: validação de nomes inconsistente; excluir variante apaga mapeamentos de fornecedor sem aviso; busca `contains` diferente entre produto e cliente; `handle` público em use cases; tipagem e código morto.
- Estoque: ajuste para baixo perde vínculo com lotes consumidos; dashboard de estoque carrega tudo em memória; `Content-Disposition` com texto do usuário; busca de caixas por lote fixa em 10; criação de caixa sem idempotência; mappers `any`.
- Vendas/financeiro: venda sem limite de itens (N+1 com travas); detalhe mostra só o primeiro documento a receber; `FinancialService` mistura reais e centavos; status `PENDING` sem uso; vendedor cancela venda de qualquer vendedor; testes do dashboard frouxos.
- Compras/NF-e: nota 100% bonificação/total zero; data de emissão convertida de fuso; decodificação assume UTF-8; N+1 na criação de variantes; custo unitário arredondado vs total do item; corrida exclusão de fornecedor × pedido.
- Frontend: chave `["auth","me"]` fora de `queryKeys`; dependências de ferramenta em `dependencies`; a11y (`aria-invalid`/`aria-describedby`, `htmlFor`, botões de ícone sem nome, estados de carregamento); ProductForm sem validação no cliente; detalhe do cliente mostra UUID; totais de venda/compra são estimativas sem aviso; erros de item da NF-e persistem após correção; tipagem frouxa e código morto.

### Menores adiados nas revisões das ondas
- Produção: checagens dependem de `NODE_ENV=production` sem aviso fora dela; sem teste da chave do rate limit (usuário vs IP) e dos limites padrão.
- Dashboard e lista divergem em linhas PAID inconsistentes (aceito na spec da onda 3).
- NF-e: redirecionamento após confirmar pode puxar o usuário de volta / ignora troca de importação; tela de revisão com campos `type=number` (valores com ponto, ex. "132.36"); `?mode` validado depois de ler o arquivo.
- Leitor: falha ao carregar o chunk do `html5-qrcode` mostra erro genérico.
- UI: unificar cantos e sombras (B7), indicadores de carregamento (B9), locale nativo de datas (B10); menu "⋯" dos cartões altera o DOM do React para rótulos; rolagem encadeada sob overlays no iOS não verificada.
- Diversos: `InMemoryTransactionManager` fica no código de produção; `Promise.all` nas leituras usa 2 conexões fora de transação; export financeiro carrega tudo antes de checar o limite de 50 mil; sem índice em `StockMovement.inventoryLotId`; lacunas de teste (parâmetros de export, envio duplo em marca/categoria/fornecedor/usuário).

Nenhum desses itens afeta dados nem segurança; o usuário recebeu a oferta de uma "onda de acabamento".

### Ações do operador (dependem do usuário)
1. **Trocar a senha temporária do admin** criada na recuperação de 2026-10-23 (tela "Alterar senha" ou `npm run create-admin`).
2. **`COMPANY_CNPJ`** no `backend/.env` com o CNPJ da empresa (obrigatório em produção para importar NF-e).
3. **Lotes de 1 unidade da contagem:** `cd backend && npm run merge-count-lots` (simulação); conferir e rodar com `-- --apply`.
4. **Teste em aparelho real** (iPhone/Safari, Android/Chrome, tablet nas duas orientações) com `npm run dev:https`.
5. **Backup diário no cron:** `PGCONTAINER=api_db_1 npm run backup-db` (exemplo em `backend/README.md`).
6. **Produção:** `NODE_ENV=production`, `CORS_ORIGINS`, `JWT_SECRET` ≥ 32, `TRUST_PROXY` com número de saltos ou IP (não `true`), `COMPANY_CNPJ`, nginx com HTTPS (README raiz).
7. Recadastrar os produtos com preço de venda (dados perdidos no apagamento de 2026-10-23).

### Onda 9 — acabamento (2026-10-26)
Baixos da revisão e menores adiados: senha limitada a 72 bytes, replay de idempotência com cabeçalhos, custos `Decimal(14,4)`, FKs restritivas no histórico financeiro, nome/busca padronizados, ajuste por lote, dashboard de estoque em SQL, limite de 200 itens por venda, NF-e de bonificação (total zero, confirmável pela tela), data de emissão declarada, encoding do XML, a11y dos campos, datas/horas em São Paulo, revisão da NF-e com MoneyInput, dependências mortas removidas, `tools/visual-qa/` versionado. Ainda abertos: status `PENDING` da venda (só documentado), exclusão de produto apaga mapeamentos em cascata, M4 (duplicatas descartadas em nota de total zero), resíduo do custo médio ao desfazer entrada (limite documentado).

### Próximo: precificação, crediário e caderninho (planejado, não implementado)
Desenhos e planos aprovados para planejamento em 2026-10-26 — implementação só quando o usuário liberar. Ordem e decisões pendentes: `docs/ROADMAP.md`. Specs: `docs/superpowers/specs/2026-10-26-{pricing,credit,notebook-import}-design.md`; planos em `docs/superpowers/plans/` com os mesmos nomes. Decididos: vendedor só pede cancelamento de venda (ADMIN aprova); venda no crediário com parcela paga continua sem cancelamento. Depois decididos pelo usuário (2026-10-26, spec do crediário §10): estorno automático do pagamento à vista até 7 dias; dívida do caderninho não bloqueia por atraso nem pontua; crediário sai desligado até a dona conferir os valores.

### Precificação e lucro (2026-10-27)
Implementada (branch `feat/pricing`): preço sugerido a partir do custo médio completo + despesas + margem, margem por categoria/produto/variante, preço da revista do fornecedor, simulador por forma de pagamento (cartão com/sem repasse), lista "Preços para revisar" (gatilhos em estoque/configuração), custo gravado em cada venda, relatório de lucro (JSON/CSV) e cartões no painel (só ADMIN), frete/despesas da compra no custo. Decisão: VENDEDOR não vê custo; ESTOQUISTA vê custo, não vê margem/lucro. Pendente do operador: preencher Configurações de preço (margem, despesas, taxas de cartão) e conferir "Preços para revisar". Ficaram abertos (menores): devolução de venda muda custo médio sem abrir revisão; recálculo de todo o catálogo ao salvar configurações segura a trava exclusiva; sem teto de valor em alguns cálculos (500 em vez de 4xx).

**Nota (2026-10-27):** o CI do backend falhou uma vez em `2468b91` (merge da precificação) e passou em `228c536` sem mudança de código de produção; não reproduziu localmente (banco novo, `CI=true`, 2 CPUs, 3 rodadas). Suspeita: teste sensível a tempo/paralelismo. O CI agora publica os testes que falharem como anotações (`ci.yml`); se voltar a falhar, ler o nome ali e estabilizar o teste.

### Crediário (2026-11)
Implementado na branch `feat/credit` (14 tarefas do plano `docs/superpowers/plans/2026-10-26-credit.md`; spec `docs/superpowers/specs/2026-10-26-credit-design.md`). Aguardando a revisão final e o merge na `main`.

**Entregue**
- Cancelamento por pedido: VENDEDOR pede, ADMIN aprova/recusa (tela "Pedidos de cancelamento"); o vendedor vê o motivo da recusa no detalhe da venda.
- Permissão por usuário "Pode aprovar crédito" (`canApproveCredit`) e permissões `credit.manage`/`credit.approve`/`credit.request`/`sales.cancel.request`.
- Configurações do crédito (faixas de parcelas, parcela mínima, taxa, vencimento, bloqueio por atraso, multa/juros/carência, aprovação automática) e perfis Novo/Regular/Bom/Excelente; ficha de crédito do cliente com histórico de mudanças.
- Fechamento da venda com condição de pagamento: dinheiro, PIX, débito, crédito 1–12x (repasse da taxa opcional, padrão sim) e crediário (entrada, parcelas Price, dia de vencimento), com simulação ao vivo e autorização de exceção (limite/atraso) por aprovador com senha.
- Pedidos de aumento de limite (com aprovação automática para perfis Bom/Excelente com bom histórico).
- Multa (até 2%) e juros pró-rata no pagamento em atraso, com dispensa por aprovador; vendas e documentos antigos ficam sem encargos (`noLateFees`).
- Revisão periódica do crédito (tela com prévia e aplicação por seleção; script `npm run credit-review`, **cron desligado**).
- Dados da loja, carnê e recibo em PDF, botão de WhatsApp (`wa.me`) com o resumo.
- Verificação final (Task 14): backend 1036 testes (5 rodadas verdes, mais 1 num banco novo com as 37 migrations), frontend 895 (2 rodadas), lint/tipos/build limpos; QA visual em 375/768/1280 nos dois temas sem rolagem horizontal e contraste sem falhas; carnê e recibo conferidos em PDF. O teste instável do painel ("vencido"/"a pagar") vinha do usuário de teste compartilhado reescrito a cada chamada (`getTestUserId`), que abortava as transações REPEATABLE READ do teste: corrigido.
- Relatórios honestos (Task 14): receita de venda = itens (acréscimo do cartão e juros do crediário fora); taxa de cartão absorvida desconta do lucro (coluna "Taxa de cartão"); `sales.csv`/`sale-items.csv` ganharam "Acréscimo" e "Forma de pagamento" no fim; multa/juros recebidos não entram em vendas nem lucro.

**Decisões**
- Cancelar venda é só do ADMIN; o vendedor pede.
- Venda paga no ato (dinheiro/PIX/cartão/entrada do crediário): o cancelamento estorna o pagamento automaticamente só até **7 dias corridos** da venda; depois, 409.
- Venda no crediário com parcela paga continua sem cancelamento (`SALE_HAS_PAYMENTS`).
- Dívidas do caderninho contam no saldo e no limite, mas não bloqueiam por atraso nem pioram perfil/pontuação.
- O crediário nasce **desligado**; ativar exige dados da loja completos e ao menos um aprovador marcado.
- Cron da revisão mensal fica desligado até a dona aprovar os pesos da pontuação.
- Taxa de cartão é gravada na venda mesmo sem repasse (para o lucro); acréscimo e juros não são receita de venda.

**Ficou aberto (menores)**
- ~~Bloqueio por atraso ainda conta dívida vencida do caderninho~~ — resolvido na migração do caderninho (`countsAsLate()`).
- Carnê usa multa/juros/carência atuais (não o retrato da venda); recibo sem valor por extenso; nomes com caracteres fora do WinAnsi saem com "?" no PDF.
- A senha do aprovador é conferida (bcrypt, ~100 ms) com a ficha do cliente travada.
- Detalhe da venda sem margem (a API não traz); prévia da revisão percorre todos os clientes ativos a cada carga.
- Na visão por produto/categoria do lucro, a taxa de cartão de uma venda dividida em várias linhas pode variar ±1 centavo em relação à visão por venda.
- Carnê escreve "Venda #3F9A12BC" e o recibo "Venda 3F9A12BC" (cosmético).
- QA visual: o fluxo `sale-request-cancel` do `interact.mjs` não abre (o mock entra como ADMIN, que cancela direto).
- Testes do front sensíveis a tempo (`InitialInventoryPage` com esperas reais, `RouteGuard`, clique duplo do `ProductForm`) não reproduziram falha nesta etapa; ficam em observação.

**Ações do operador**
1. Preencher **Configurações de preço** (margem, despesas, taxas da maquininha): sem elas a taxa do cartão é 0.
2. Preencher **Dados da loja** (nome, CNPJ, endereço, telefone) — exigido pelo carnê, pelo recibo e para ativar o crediário.
3. Marcar em Usuários quem "Pode aprovar crédito".
4. Conferir os valores das **Configurações do crédito** e dos perfis (faixas, parcela mínima R$ 30, taxa 3,99% a.m., limites, entrada mínima, multa/juros/carência) e **ativar o crediário**.
5. Aprovar os pesos da revisão mensal antes de ligar o cron do `npm run credit-review`.
6. Testar em aparelho real (celular e tablet): fechamento da venda em cada condição, autorização de exceção, carnê/recibo (baixar e compartilhar) e o botão de WhatsApp.

### Migração do caderninho (2026-11)
Implementada na branch `feat/notebook-import` (9 tarefas do plano `docs/superpowers/plans/2026-10-26-notebook-import.md`; spec `docs/superpowers/specs/2026-10-26-notebook-import-design.md`). Sem dependência nova; uma migration (`20261102100000_legacy_import`).

**Entregue**
- Contas a receber de origem `LEGACY` ("Caderninho"), sempre sem multa/juros (`noLateFees`), sem venda nem estoque; parcela "a combinar" (`dueDateUnknown`) que nunca aparece como vencida (lista, resumo, detalhe, painel, CSV, crédito).
- Lotes de importação: CSV pelo modelo (Excel em português ou Google Sheets) ou lançamento rápido no celular; revisão linha a linha com situação, avisos em português, edição na própria linha (com o texto original quando o valor não pôde ser lido), ignorar/restaurar, filtro de avisos/erros.
- Nomes parecidos (conservador: "Maria Silva" × "Mariana Silva" não junta; "Maria S." e "Jose"/"José" juntam), vínculo automático por nome idêntico (marcado "confira"), "mesma pessoa da linha N", aviso de cliente vinculado excluído.
- Confirmação atômica e idempotente: cria clientes, uma dívida por linha, aplica perfil e limite (regra `limitRule`) com histórico `LEGACY_IMPORT`. Desfazer seguro (recusado com pagamento).
- "Parcelar saldo" a combinar em 1–24 parcelas (modal com divisão automática e edição).
- Ficha do cliente mostra quanto do saldo é do caderninho (etiqueta "Caderninho").
- Verificação final (Task 9): backend 1121 testes, 5 rodadas (3 verdes; uma falha instável de teste corrigida — inicial aleatória "E" virava partícula — e uma do relatório de lucro, antiga, sem relação), mais 1 rodada verde num banco novo com as 39 migrations; frontend 946 testes (2 rodadas), lint/tipos/build limpos; roteiro ponta a ponta automatizado (`legacyEndToEnd.test.ts`); QA visual 375/768/1280 nos dois temas sem rolagem horizontal e contraste sem falhas.

**Decisões**
- Dívida antiga entra **sem juros nem multa**, mesmo com vencimento anotado no passado.
- Conta no saldo e no limite, mas **nunca bloqueia** o crediário por atraso **nem pontua** (perfil/revisão).
- Nome idêntico a um único cliente vincula automaticamente; a tela pede conferência e permite "Criar novo".
- Limite na confirmação: padrão = maior entre limite atual, limite inicial do perfil e saldo importado (o cliente não começa estourado); opção "só o limite do perfil".
- **Desfazer mantém** clientes criados, perfil e limite (o histórico fica); só cancela as dívidas, e só se nenhuma recebeu pagamento.
- Parcelar um saldo a combinar não conta como renegociação.
- Parcela datada vencida do caderninho aparece como "Vencida" em contas a receber e no painel (é uma cobrança atrasada de fato), sem encargos e sem efeito no crédito.

**Ficou aberto (menores)**
- Busca de candidatos acima de 5.000 clientes compara só o 1º termo do nome (sem acento); nomes com apóstrofo ("D'Ávila") podem não aparecer como parecidos.
- Inicial isolada "E." num nome é lida como partícula ("e") e some da comparação ("Maria E. Silva" × "Maria Eduarda Silva" não é sugerido).
- Mudar a quantidade de parcelas ou a 1ª data no modal de parcelar refaz a sugestão e apaga edições manuais (há um aviso na tela).
- Confirmação simultânea de lote muito grande (2.000 linhas) pode responder 409 `CONCURRENT_UPDATE` (trava de 5 s) em vez de `LEGACY_BATCH_NOT_DRAFT` (os dois seguros).
- Recibo de dívida do caderninho ("Saldo anterior — caderninho") sem teste HTTP próprio (só o conteúdo).
- Teste instável antigo do relatório de lucro (`profitReport.test.ts`, despesas estimadas) quando outro arquivo muda as configurações de preço durante a consulta: não segura `acquirePricingTestLock()`.

**Passo a passo do operador**
1. Separar o caderno. Para cada cliente com dívida: nome, celular (se tiver), data e descrição da compra, valor total, quanto já pagou, vencimentos combinados (se houver) e perfil (Novo/Regular/Bom/Excelente, se souber).
2. Escolher a entrada: (a) baixar o **modelo** em Financeiro → Migração do caderninho e preencher no Excel/Google Sheets (uma linha por dívida; `vencimentos` como `10/12/2026=500,00; 10/01/2027=500,00`, somando o saldo); (b) **fotos**: fotografar as páginas com boa luz e pedir ao Claude que transcreva para o modelo CSV (conferir os valores antes de enviar); (c) **lançamento rápido** no celular, cliente por cliente.
3. Enviar a planilha e **revisar**: corrigir as linhas com erro, ignorar linhas que não são dívida (totais da página, rabiscos), decidir os nomes parecidos ("É a mesma pessoa" / "Criar novo") e conferir os vínculos automáticos.
4. Escolher a regra do limite e **confirmar**. Conferir em Contas a receber (etiqueta "Caderninho") e na ficha dos clientes.
5. Para saldos "a combinar", quando o cliente acertar as datas: abrir a conta e usar **Parcelar saldo**.
6. Ajustar perfis e limites na ficha do cliente quando necessário (o histórico mostra a origem "Migração do caderninho").
7. Se algo saiu errado: **Desfazer lote** (só sem pagamentos; estorne antes). Clientes e limites continuam.
