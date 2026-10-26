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
Desenhos e planos aprovados para planejamento em 2026-10-26 — implementação só quando o usuário liberar. Ordem e decisões pendentes: `docs/ROADMAP.md`. Specs: `docs/superpowers/specs/2026-10-26-{pricing,credit,notebook-import}-design.md`; planos em `docs/superpowers/plans/` com os mesmos nomes. Decididos: vendedor só pede cancelamento de venda (ADMIN aprova); venda no crediário com parcela paga continua sem cancelamento. Aguardando o usuário: estorno automático do pagamento ao cancelar venda à vista; dívida do caderninho não bloquear por atraso; valores iniciais do crediário (sai desligado até confirmar).
