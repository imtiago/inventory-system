# Onda 9 — Acabamento

**Data:** 2026-10-26

**Status:** decidido. O usuário pediu: "você pode seguir com isso".

**Escopo:** os Baixos ainda abertos da revisão geral e os menores adiados das ondas, listados em `docs/HISTORICO.md` na seção "Pendências" e, por área, em `docs/reviews/2026-10-25-pendencias-apos-onda3.md`, seção "Baixos". Cada item está no documento de origem com `arquivo:linha` e a sugestão de correção.

## Fora do escopo
Estes itens precisam de decisão do usuário ou já foram aceitos:
- Vendedor cancela venda de qualquer vendedor. É regra de negócio; vai como pergunta ao usuário.
- Dashboard e lista divergem em linhas PAID inconsistentes. Foi aceito na onda 3.
- Token em localStorage. Decisão registrada.
- Tudo que o crediário vai redesenhar:
  - parcelas e juros da venda;
  - o detalhe da venda com mais de um documento a receber, que passa a ser tratado pelo crediário.

## 1. Backend (Baixos e menores)
### Comum
- Senha com mais de 72 bytes: recusar na validação com a mensagem "A senha deve ter no máximo 72 bytes", em vez de truncar.
- Replay de idempotência reproduz os cabeçalhos relevantes, como `Location` e `Content-Disposition`.
- Histórico financeiro sem `onDelete: Cascade`: trocar por `Restrict` em migration, conferindo antes que nenhum fluxo apaga documento.
- Custo `Decimal` com escala explícita, `Decimal(14,4)` nos custos unitários e médios, em migration aditiva.
  - Conferir antes os valores existentes e o arredondamento `roundCost`.
- Remover as dependências mortas (jest, ts-jest, supertest, ts-node-dev, `jest.config.js`) se nada as usa.
- Seed protegido: recusa rodar fora de banco de desenvolvimento vazio, ou exige `--force`.
- Aviso no log de subida quando `NODE_ENV` não é `production` e `CORS_ORIGINS` ou `COMPANY_CNPJ` faltam.
- Teste da chave do rate limit (usuário × IP) e dos limites padrão.
- `InMemoryTransactionManager` sai do código de produção e vai para os testes.

### Catálogo e clientes
- `nameSchema` comum, com `normalizeWhitespace` e `max`.
- Excluir variante avisa ou bloqueia quando há mapeamento de fornecedor (409 com mensagem).
- Helper único de busca literal: escapar `%`, `_` e `\` igual em produto, cliente, marca e categoria.
- Fazer `handle` privado onde aparece, e limpar a tipagem e o código morto listados.

### Estoque
- Ajuste para baixo registra os lotes consumidos.
- Dashboard de estoque agregado em SQL.
- `Content-Disposition` com nome de arquivo sanitizado (RFC 5987).
- Busca de caixas por lote paginada.
- Criação de caixa idempotente.
- Mappers sem `any`.
- Índice em `StockMovement.inventoryLotId`, se a consulta existir.

### Vendas e financeiro
- Limite de itens por venda: 200, com mensagem.
- Leituras de itens/variantes em lote, sem N+1 dentro da trava.
- `FinancialService` só em centavos.
- Remover o status `PENDING` se nada o usa. Se usa, documentar.
- Testes do dashboard mais rígidos.
- Exportação financeira conta antes, ou usa `LIMIT`, sem carregar tudo. Conferir o que a onda 3 já fez.
- `Promise.all` de leituras na mesma conexão quando estiver dentro de transação.

### Compras e NF-e
- Nota 100% bonificação ou com total zero: aceitar, sem parcelas e sem contas a pagar.
- Data de emissão preservada como declarada na nota.
- Decodificação do XML respeita o `encoding` declarado.
- Criação de variantes sem N+1.
- Custo unitário com 4 casas, alinhado ao `Decimal(14,4)`.
- Corrida entre excluir fornecedor e criar pedido: trava ou FK, com mensagem.
- `?mode` validado antes de ler o arquivo.

## 2. Frontend (Baixos e menores)
### Comum
- Chave `["auth","me"]` em `queryKeys`.
- Ferramentas de build em `devDependencies`.
- Acessibilidade:
  - `aria-invalid` e `aria-describedby` em todos os campos;
  - `htmlFor` nos rótulos;
  - nome em todo botão de ícone;
  - estados de carregamento padronizados (B9).
- Cantos e sombras unificados (B7).

### Telas
- ProductForm com validação no cliente.
- Detalhe do cliente mostra o código, não o UUID.
- Totais de venda e compra mostram "Estimativa" quando dependem do servidor.
- Erros de item da NF-e somem quando o item é corrigido.
- Tela de revisão da NF-e com `MoneyInput`/`QuantityInput`, sem `type=number`.
- Redirecionamento após confirmar a NF-e respeita a troca de importação.
- Falha ao carregar o leitor (chunk do `html5-qrcode`) mostra "Nova versão disponível — recarregar".
- Menu "⋯" dos cartões sem mexer no DOM do React: rótulo explícito por ação.
- Datas exibidas sempre em dd/mm/aaaa. Os campos nativos podem seguir o navegador, mas o valor exibido em listas e detalhes é pt-BR.
- `overscroll-contain` nos overlays.

### Testes
- Parâmetros enviados pela exportação.
- Envio duplo em marca/categoria, fornecedor e usuário.

### Ferramentas
- QA visual versionado em `tools/visual-qa/`: mock da API a partir das fixtures, captura por CDP em várias larguras e nos dois temas, e medição de contraste, com README de uso.
- Atualizar o `CLAUDE.md` para apontar para a pasta.

## Testes e aceite
- Cada correção de comportamento tem teste que falha antes. Refactors puros são cobertos pela suíte existente.
- Migrations: backup, SQL à mão, `migrate deploy` em dev e em `inventory_test`.
- Aceite:
  - CI verde;
  - backend `npm test` 2×;
  - frontend lint, typecheck, testes e build;
  - QA visual nos dois temas em 375 e 1440 px.
