# Achados restantes da revisão geral (2026-10-25) após as ondas 1–3

Base: `main` em 0b46a30. Fontes: revisão `docs/reviews/2026-10-25-revisao-geral.md`; specs das ondas 1 (integridade), 2 (telas) e 3 (produção). Status verificado por grep quando a spec era ambígua.

## Contagem

| Severidade | Total | Feito | Parcial | Aberto |
|---|---|---|---|---|
| Alto | 11 | 11 | 0 | 0 |
| Médio | 49 | 26 | 2 | 21 |
| Baixo | 63 | 9 | (3 dentro dos abertos) | 54 |

Legenda de seções: W1 = onda 1, W2 = onda 2, W3 = onda 3 (número = seção da spec).

## Altos (todos feitos)

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Trocar/redefinir senha não invalida tokens | Alto | FEITO | W1 §1 (`passwordChangedAt` vs `iat`) |
| Sem build/start de produção nem shutdown gracioso | Alto | FEITO | W3 §1 |
| Preço de venda sem teto | Alto | FEITO | W1 §4 (`.max` em `createVariantSchema`) |
| Estoque em caixas nunca baixado | Alto | FEITO | W1 §5 (invariante + rota remove + `fix-box-stock`) |
| /receive e /dispatch com origem livre | Alto | FEITO | W1 §2 |
| Etiquetas sem limite | Alto | FEITO | W1 §3 |
| Contas a receber/pagar em memória | Alto | FEITO | W3 §4 (SQL) |
| NF-e estoura Int/Decimal | Alto | FEITO | W1 §4 |
| Bundle único ~989 kB | Alto | FEITO | W3 §5 |
| Edição de variante com cache velho | Alto | FEITO | W2 §1 |
| Erros de telefone/endereço do cliente invisíveis | Alto | FEITO | W2 §1 |

## Backend: comum, auth, banco, CI

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Limitador de login em memória, IP+e-mail, sem trustProxy | Médio | PARCIAL | `TRUST_PROXY` feito (W3 §2). Continua em memória (`Map`), sem limite por IP nem por conta isolados |
| JWT_SECRET fraco / env não validado | Médio | FEITO | W3 §1 (Zod; mínimo 32 só com `NODE_ENV=production`, ver menores) |
| Testes escrevem no banco de dev | Médio | FEITO | W1 §6 |
| Faltam índices origem/histórico | Médio | FEITO | W3 §3 |
| Sem CHECK nem unicidade de origem no banco | Médio | ABERTO | Nenhuma migration com CHECK; sem unique em `FinancialDocument(type, originType, originId)`; W3 criou só índices |
| Migrations que falham em banco com dados | Médio | ABERTO | `nome_da_alteracao` (Customer.code NOT NULL sem backfill) e `user_active_email_normalized` (UPDATE lower/trim) inalteradas |
| Sem rate limit global/helmet/health/limites | Médio | FEITO | W3 §2 |

## Backend: catálogo e clientes

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Código de barras: corrida vira 409 genérico, sem limite de tamanho | Médio | ABERTO | Sem `.max()` no barcode; P2002 de barcode não mapeado no repositório |
| Variantes/produtos sem índice em FK | Médio | FEITO | W3 §3 |
| Edição de produto/variante sem trava (lost update) | Médio | ABERTO | `toUpdatePersistence` ainda grava todos os campos, sem lock |
| VENDEDOR altera preço de venda e catálogo | Médio | ABERTO | Decisão do usuário pendente; `catalog.write` segue com VENDEDOR |
| Clientes sem unicidade/documento fiscal | Médio | ABERTO | Decisão de negócio (CPF/CNPJ, duplicidade) |

## Backend: estoque

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Ajuste de inventário corta reservas silenciosamente | Médio | ABERTO | `Inventory.adjust` ainda faz `reserved = counted`; decidir recusar vs RELEASE |
| Reserva/liberação sem vínculo com a origem | Médio | ABERTO | `release` sem `originId` |
| Consumo de lotes por criação, não FEFO | Médio | ABERTO | Conhecido; `orderBy createdAt` sem desempate; política de vencidos a decidir |
| Entrada no mesmo lote ignora novo custo/datas | Médio | ABERTO | `lot.receive` soma só quantidade |
| Contagem cria um lote por bipe sem lote | Médio | ABERTO | `RegisterScannedProductUseCase` inalterado |
| Listagem de movimentações: total sem filtros | Médio | ABERTO | `count()` sem `where` (bug simples) |
| Consulta de caixa não informa quantidade na caixa | Médio | ABERTO | `InventoryBoxStockItemDTO` sem `quantity` |
| StockMovement sem índices | Médio | FEITO | W3 §3 |

## Backend: vendas, financeiro, dashboard, relatórios

| Título | Sev. | Status | Nota |
|---|---|---|---|
| FinancialDocument sem índices | Médio | FEITO | W3 §3 (o `@@unique` sugerido não foi feito; ver CHECK/unique) |
| Resumo da lista ignora intervalo de vencimento | Médio | ABERTO | W3 §4 manteve a semântica por documento; export recorta por parcela, resumo não |
| CSV itens vendidos: colunas Produto/Variante trocadas | Médio | ABERTO | Query ainda usa `si.productName` e `v.name` |
| Dashboard agrega Payment inteira | Médio | FEITO | W3 §4 |

## Backend: compras e NF-e

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Tolerância de centavos no vNF gera 422 INSTALLMENTS_TOTAL_MISMATCH | Médio | ABERTO | Regra a decidir (ajustar última parcela vs mostrar divergência) |
| nItem duplicado não rejeitado | Médio | ABERTO | Parser cai em `position + 1` |
| Lotes da nota descartados em colisão; dVal/dFab sem validação | Médio | ABERTO | |
| Mesmo supplierCode sobrescreve mapeamento | Médio | ABERTO | Mapeamento com código vazio também |
| Nota recebida não pode ser desfeita | Médio | ABERTO | Decisão pendente (estorno de recebimento vs aviso de irreversível) |
| NF-e não-compra importada como compra | Médio | ABERTO | Decisão pendente (tipos aceitos, `dest`, `cStat`) |

## Frontend: comum, login, usuários, dashboard

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Token em localStorage; logout não sincronizado entre abas | Médio | PARCIAL | Interceptor/guarda de logout melhorados (W1, commits 128478a/c7054bc), mas sem listener `storage`, escritas sem try/catch e token ainda em localStorage |
| ConfirmDialog sem foco/Escape/scroll | Médio | FEITO | W2 §4 |
| Modal: ids fixos, Escape empilhado/durante envio | Médio | FEITO | W2 §4 |
| Falha transitória em /users/me manda ao login | Médio | FEITO | W2 §4 |
| Sem tratamento global de 403 | Médio | FEITO | W2 §4 (o teste de contrato das matrizes front/back não foi pedido) |
| Limpeza de cache no login | Médio | FEITO | W2 §4 (`setSession` limpa o cache) |

## Frontend: catálogo, clientes, estoque (10 Médios, todos feitos)

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Formulários sem estado de envio (clique duplo) | Médio | FEITO | W2 §1 |
| Assistente: Voltar durante "Adicionar à caixa" | Médio | FEITO | W2 §2 |
| Etiquetas: `window.open` após await | Médio | FEITO | W2 §2 (download por link; W3 §6 documenta) |
| Busca do assistente fora de ordem | Médio | FEITO | W2 §2 |
| Lista de estoque sem estados/Status falso/sem gate | Médio | FEITO | W2 §2 |
| Formulário de lote: erro duplicado, custo 0 | Médio | FEITO | W2 §2 |
| Dropdowns truncados em 100 | Médio | FEITO | W2 §1 |
| Detalhe do produto sem tratamento de erro | Médio | FEITO | W2 §1 |
| Coluna de estoque: 1 requisição por linha | Médio | FEITO | W2 §2 (`GET /inventory?productVariantIds=`) |
| Variante do assistente sem preço | Médio | FEITO | W2 §1 |

## Frontend: vendas, financeiro, compras, NF-e (3 Médios, todos feitos)

| Título | Sev. | Status | Nota |
|---|---|---|---|
| Confirmação NF-e não redireciona | Médio | FEITO | W2 §3 (menor: ver abaixo) |
| Cancelar oferecido com pagamento registrado | Médio | FEITO | W2 §3 |
| Exportação de vendas com período que a lista não aplica | Médio | FEITO | W2 §3 |

## Menores adiados das ondas 2–3 ainda abertos

| Título | Área | Nota |
|---|---|---|
| Verificações de produção dependem de `NODE_ENV=production`, sem aviso | Segurança | `JWT_SECRET` >= 32 e `CORS_ORIGINS` só são exigidos em produção; sem warning fora dela |
| Sem teste da chave do rate limit (sub vs IP) nem dos limites padrão | Segurança/testes | |
| Dashboard vs lista divergem em linhas PAID inconsistentes | Finanças | Dashboard só lê OPEN/PARTIALLY_PAID (W3 §4) |
| Redirect da NF-e ignora troca para outra importação | Compras/NF-e (front) | Checa só "ainda na tela da importação" |
| Falha de chunk do html5-qrcode mostra erro genérico do scanner | Frontend | |

## Baixos: 9 feitos, 54 abertos

Feitos (9): CORS reflete qualquer origem (W3 §2); erros 4xx do Fastify/pool esgotado (W3 §2); catálogo "Testes dependem do banco compartilhado" (W1 §6); total da venda estoura Decimal (W1 §4); listagem de vendas sem índice de data (W3 §3, `Sale(createdAt)`); cache de inventário não atualiza na mudança de variante (W2); criar/cancelar venda não invalida financeiro (W2 §3); primeiro vencimento no passado (W2 §3); invalidação de fornecedor (W2 §3).

Abertos (54), por área. (parcial) = parte resolvida.

- Backend comum (6): senhas > 72 bytes truncadas; replay de idempotência sem cabeçalhos / headers antes do commit; `onDelete: Cascade` em histórico financeiro; precisão de custo (`Decimal` sem escala); dependências/configs mortas e CI sem drift do schema; seed grava clientes fictícios em qualquer banco.
- Catálogo e clientes (8): resposta de create/update de variante lida fora da transação; produto nasce com variante "Padrão" preço 0; validação de nome inconsistente / variante sem normalização; exclusão de variante apaga mapeamentos de fornecedor sem avisar; busca `contains` diferente em produto e cliente; contratos e rotas inconsistentes; tipagem e código morto; `handle` público em use cases transacionais.
- Estoque (9): ajuste para baixo perde vínculo com lotes consumidos; custo médio sem arredondamento / Decimal sem escala; dashboard de estoque carrega tudo em memória; Content-Disposition com texto do usuário; busca de caixas por lote fixa em 1 página de 10; criação de caixa sem idempotência; código morto e auditoria mutável; mappers `any`; testes usam banco de dev e deixam lacunas (parcial: banco de teste feito em W1 §6).
- Vendas, financeiro, dashboard, relatórios (6): venda sem limite de itens (N+1 com travas); detalhe mostra só o primeiro documento a receber; contrato do FinancialService mistura reais e centavos; status PENDING sem uso / default divergente; vendedor cancela venda de qualquer vendedor; testes do dashboard aceitam quase qualquer valor.
- Compras e NF-e (8): NF-e 100% bonificação/total zero; data de emissão convertida de fuso; decodificação assume UTF-8; N+1 na criação de variantes (transação de 30 s); custo unitário arredondado vs total do item; corrida exclusão de fornecedor x pedido; código morto/enums sem uso; testes acoplados a fixtures do front e ao banco (parcial).
- Frontend comum (6): chave `["auth","me"]` fora de `queryKeys` e permissão duplicada; dependências não usadas/de ferramenta em `dependencies`; a11y de formulários sem `aria-invalid`/`aria-describedby` (parcial: formulários de cliente em W2 §1); guard de teste de Idempotency-Key lança no `afterEach`; ExportButton/downloadFile; ForbiddenPage vs 404.
- Frontend catálogo/clientes/estoque (6): a11y labels sem `htmlFor` e botões de ícone sem nome; ProductForm sem validação no cliente e h1 vazio; detalhe do cliente mostra UUID; estado `loading` compartilhado nos hooks de estoque; código morto/duplicado/tipagem frouxa; testes que verificam pouco.
- Frontend vendas/financeiro/compras/NF-e (5): total/subtotal são estimativas sem aviso de divergência; erros de item da NF-e persistem após correção; cobertura de idempotência desigual; tipagem frouxa nos filtros e código morto; a11y de estados de carregamento.

## Proposta de próximas ondas (itens Médio abertos/parciais + menores adiados)

### Onda 4: Decisões de negócio (7 Médios; bloqueia partes das ondas 5–7)
Itens: VENDEDOR altera preço/catálogo; unicidade/CPF-CNPJ de clientes; NF-e não-compra (tipos aceitos, destinatário, cStat); desfazer NF-e recebida; FEFO/política de lotes vencidos; ajuste de inventário abaixo do reservado (recusar vs RELEASE); tolerância de centavos do vNF (ajustar parcela vs exibir divergência).
Justificativa: cada um muda regra de negócio e precisa de resposta do usuário antes de qualquer código; resolvidos primeiro, destravam as ondas seguintes.

### Onda 5: Integridade de dados e banco (2 Médios + corretude de relatórios 2 Médios)
Itens: CHECK de dinheiro/estoque + unique parcial em `FinancialDocument`; migrations que falham em banco com dados; resumo da lista com intervalo de vencimento; CSV itens vendidos com colunas trocadas. Baixos relacionados: `onDelete: Cascade`, precisão Decimal, CI com drift do schema.
Justificativa: a rede de proteção que faltou no banco e dois números que hoje saem errados; migrations precisam de dados reais para testar o backfill. (Os dois itens de relatório são corretude, não banco; ficam aqui por serem correções pequenas e independentes.)

### Onda 6: Catálogo e clientes (2 Médios + os 2 decididos na onda 4)
Itens: barcode (P2002 -> `BARCODE_ALREADY_EXISTS` e `.max`); lost update em produto/variante (gravar só campos alterados ou lock); mais VENDEDOR/catálogo e unicidade de cliente conforme decisão. Baixos do módulo (8) entram junto.
Justificativa: mesmo módulo, mesmo padrão (repositório Prisma e schemas), uma só rodada de testes.

### Onda 7: Regras de estoque (5 Médios + FEFO e ajuste conforme decisão)
Itens: reserva/liberação com `originId`; entrada no mesmo lote com custo/datas divergentes; contagem cria lote por bipe; total da listagem de movimentações sem filtros (correção de uma linha); quantidade na caixa no DTO. Baixos do módulo (9).
Justificativa: todas mexem em `Inventory`/`InventoryLot`/movimentos e se testam juntas; a correção do `count()` e do DTO são rápidas e entram de brinde.

### Onda 8: Compras e NF-e (3 Médios + 3 conforme decisão + 1 menor)
Itens: rejeitar nItem duplicado; lotes da nota descartados e validação dVal >= dFab; mapeamento por supplierCode (não gravar vazio/conflito); mais tolerância, não-compra e desfazer conforme decisão; menor: redirect ignora troca de importação. Baixos (8).
Justificativa: tudo no parser e no `ConfirmNfeImportUseCase`; uma só suíte de notas de teste cobre os casos.

### Onda 9: Endurecimento de segurança (2 Médios parciais + 2 menores)
Itens: limitador de login por IP e por conta (hoje em memória; decidir armazenamento); token em localStorage com sincronização de logout entre abas (listener `storage`, try/catch); menores: avisos fora de `NODE_ENV=production`; teste da chave do rate limit (sub vs IP) e dos limites padrão. Baixos: senhas > 72 bytes, headers do replay de idempotência, Content-Disposition, seed, vendedor cancela qualquer venda.
Justificativa: itens de superfície de ataque, sem regra de negócio nova; vale revisar junto com a política de implantação (proxy, uma ou várias instâncias).

### Onda 10: Higiene de código (menores + Baixos restantes)
Itens: dashboard vs lista em linhas PAID inconsistentes; falha de chunk do html5-qrcode com mensagem específica; Baixos de tipagem (`any`), código morto, `handle` público, dependências, a11y (labels, `aria-*`, estados de carregamento), testes fracos e acoplados a banco/fixtures.
Justificativa: baixo risco e sem decisão; pode correr em paralelo a qualquer outra onda.

Resumo de itens Médio por onda: 4 = 7; 5 = 4; 6 = 2 (+2 vindos da 4); 7 = 5 (+2 vindos da 4); 8 = 3 (+2 vindos da 4); 9 = 2; 10 = 0. Soma = 23 (21 abertos + 2 parciais). Menores adiados: 2 na onda 9, 1 na onda 8, 2 na onda 10.
