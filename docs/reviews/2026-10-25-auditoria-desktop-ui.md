# Auditoria de UI no desktop: posicionamento, cores e preparação para temas

**Data:** 25/10/2026. **Escopo:** frontend (`frontend/src`), apenas desktop (1280×800, 1440×900, 1920×1080). Mobile ficou de fora, com a regra de não quebrá-lo.
**Como foi feito:** build de produção (`vite build` numa pasta temporária) servido por um mock local da API com os fixtures de `src/test/fixtures` (em português) e usuário ADMIN. As telas foram capturadas com Chrome headless e revisei cada captura. O contraste foi **medido no navegador**: para cada texto visível, peguei a cor calculada e o fundo efetivo, somando 27 telas a 1440 px.
**Capturas:** `/tmp/claude-1000/-home-tiago-projects-inventory-system/a1387de3-8b3b-4ab2-a944-0a8b92f1aa4e/scratchpad/ui-audit/` (`<tela>-<largura>.png`; `-full` = página inteira; modais e venda com itens têm nomes próprios, como `change-password-1440.png` e `sale-new-items-1440-full.png`).

---

## Resumo

A aplicação funciona e tem uma base razoável (DataTable, Section, Modal), mas o visual do desktop sofre de três causas de raiz, que explicam a maior parte do que você percebeu:

1. **CSS de template do Vite que ficou no projeto** (`src/index.css`). A cor padrão do texto é `#6b6375`, um cinza-lilás. Os `h1` herdam 56 px, margem de 32 px e espaçamento de letras negativo, e a fonte raiz é de 18 px. Por isso valores, células e campos parecem "apagados", os títulos ficam espremidos e há buracos entre título e descrição.
2. **Cores escritas à mão em cada arquivo**: 916 classes de cor crua em 84 dos 127 arquivos `.tsx`, com cinco cores diferentes para "botão primário" e nenhum token semântico de verdade. Os poucos tokens do shadcn que o código usa (`text-muted-foreground`, `bg-card`, `text-destructive`) **não existem** no `tailwind.config.ts` e simplesmente não geram CSS.
3. **Layout de altura fixa** (`Page`/`Section` com `lg:h-full` e `lg:overflow-hidden`): em telas de 800–900 px de altura, as tabelas ficam espremidas e, na página do produto, as variantes desaparecem.

**Contagem:** Alto 9 · Médio 16 · Baixo 11.

---

## Alto

### A1. Modal "Alterar senha": rótulos e botão "Cancelar" invisíveis (branco no branco)
- O modal é renderizado **dentro** do `<aside className="… text-white">` do menu (`components/Sidebar.tsx:60` e `:104`), e o `Modal` não usa portal (`shared/components/Modal/Modal.tsx:68`, um `fixed` dentro da árvore). Os rótulos não definem cor (`modules/auth/components/ChangePasswordModal.tsx:47,66,84`) nem o botão Cancelar (`:107`), então herdam o branco do menu. Contraste medido: 1:1.
- Captura: `change-password-1440.png`. O mesmo acontece na gaveta do mobile.
- Correção: renderizar o Modal com `createPortal(…, document.body)` e dar cor explícita (`text-foreground`) ao corpo do modal.

### A2. Botão "Editar" do cliente invisível
- `modules/customers/pages/CustomerDetailsPage.tsx:71` passa `bg-white text-gray-900` para o `Button`, que já aplica `bg-blue-500 text-white` (`components/ui/button.tsx:8,16`). As classes são concatenadas sem `cn()`/`tailwind-merge`, então quem vence é a ordem do CSS, e o resultado é texto branco em fundo branco. Captura: `customer-detail-1440.png` (o retângulo vazio no canto).
- Correção: `button.tsx` deve usar `cn()` de `lib/utils.ts`, que já existe, e ganhar variantes (`primary`, `secondary`, `outline`, `ghost`, `danger`).

### A3. Tabelas das páginas de detalhe sem espaçamento lateral: colunas grudam ("R$ 53,23A vencer")
- `shared/components/details/DetailTable.tsx:53,63` define só `py-2`, sem `px`. Uma coluna alinhada à direita encosta na seguinte, alinhada à esquerda. Aparece em Parcelas da venda e do pedido de compra (`sale-detail-*.png`, `purchase-detail-*.png`) e piora em 1920.
- As células também não têm cor, então herdam o lilás `#6b6375`.

### A4. Altura fixa esconde conteúdo: variantes do produto somem em telas de até 900 px de altura
- `shared/components/layout/Page.tsx:13-17` (`lg:h-full lg:overflow-hidden`) junto com `shared/components/details/Section.tsx:27,58-63` (`lg:overflow-hidden`) fazem a página caber exatamente na janela. Em `modules/products/pages/ProductDetailsPage.tsx:101-185` há três blocos antes da tabela (cabeçalho, "Informações do Produto", cartão "Variantes 2"), e a tabela de variantes fica com **0 linhas visíveis** em 1280×800 e 1440×900 (`product-detail-1280.png`, `product-detail-1440.png`). Só aparece em 1080 px de altura.
- Nas listas, o mesmo padrão deixa só 4–6 linhas visíveis com rolagem interna (`products-1280.png`, `customers-1440.png`), sem indicação de que há mais.
- Correção: no desktop, deixar o `<main>` rolar a página inteira (remover `lg:h-full/overflow-hidden` de `Page` e `Section`) e usar cabeçalho de tabela `sticky` em vez de rolagem interna.

### A5. Dashboard: valores transbordam e se sobrepõem nos cartões
- `modules/dashboard/pages/DashboardPage.tsx:59` usa uma grade de 3 colunas (`sm:grid-cols-3`) dentro de uma coluna que já é metade da tela (`:106`, `lg:grid-cols-2`). O valor (`:36`, `text-xl`) não tem `min-w-0`/quebra. Em 1440, "R$ 5.230,75" e "R$ 1.180,50" vazam para fora do cartão. Em 1280, "R$ 5.230,75" encosta em "R$ 640,00" e "R$ 3.100,00" é cortado (`dashboard-1280.png`).
- Correção: usar 1 coluna para os blocos financeiros até `xl` (ou 3 colunas só em `2xl`), além de `tabular-nums`, `min-w-0` e um tamanho de valor responsivo.

### A6. Badges de status quebram em duas linhas, e a tabela de contas a receber corta colunas em 1280
- `shared/components/crud/CrudBadge.tsx:80-87` não tem `whitespace-nowrap`. Em Contas a receber, "A vencer" vira duas linhas com a pílula partida (`receivables-1440.png`). Em Pedidos de compra a 1280, "Recebido parcialmente" quebra (`purchases-1280.png`). Em Contas a receber a 1280, a coluna "Ver conta" sai da tela e a pílula "Vencida" fica cortada (`receivables-1280.png`).
- Correção: `whitespace-nowrap` no badge e larguras mínimas por coluna; a coluna "Ver conta" pode virar um ícone ou a linha inteira pode ser clicável.

### A7. Status sem cor de significado: tudo é azul
- `CrudBadge` só tem azul. `modules/sales/hooks/useSaleColumns.tsx:23-27` até define `success/warning/danger`, mas `:76` ignora isso e renderiza `<CrudBadge>`. Resultado: "Cancelada", "Vencida", "Sem estoque" e "Concluída" aparecem iguais (`sales-1440.png`, `receivables-1440.png`, `inventory-1440.png`). O mesmo ocorre em `modules/finance/pages/FinanceListPage.tsx:64`, `FinanceDetailPage.tsx:61,103`, `PurchaseDetailPage.tsx:55` e `modules/inventory/hooks/useInventoryColumns.tsx:43,53,60` (este último usa a pílula azul até para quantidades, inclusive 0).
- Correção: `Badge` com variantes `neutral | info | success | warning | danger` ligadas aos tokens de tema, mais um mapa único de status para variante.

### A8. Cor de texto padrão é o cinza-lilás do template, e há tokens usados que não existem
- `src/index.css:12` (`--text: #6b6375`), `:32` (`--foreground: #6b6375`) e `:33` (`color: var(--text)`). Todo texto sem classe de cor herda esse tom: **valores de estatística do dashboard e do estoque, valores dos detalhes, células do DetailTable, texto digitado nos campos, botões de paginação, títulos dos cartões do Inventário Inicial e o total da venda**. O contraste passa (5,73:1 no branco), mas o tom roxo destoa dos cinzas `gray`/`slate` do resto e tira o peso dos números. Essa é a queixa dos "valores em cinza". Medição: 260 nós de texto em 20 telas usam essa cor.
- O `tailwind.config.ts:8-16` só define `border, background, foreground, ring, input, primary, primary-foreground`. As classes `text-muted-foreground`, `bg-card`, `bg-muted` e `text-destructive` usadas em `modules/inventory/pages/InventoryDetailsPage.tsx:24,32,38,59,75,110,153,203` **não geram CSS**. Os cartões do estoque ficam sem fundo (transparentes sobre o cinza) e **as mensagens de erro não ficam vermelhas**.

### A9. CSS global do template deixa títulos espremidos e com espaço demais
- `src/index.css:60-91`: todo `h1` recebe `font-size: 56px; letter-spacing: -1.68px; margin: 32px 0` e todo `h2` recebe `margin: 0 0 8px; color: var(--text-h)`. As utilities do Tailwind sobrescrevem o tamanho, mas **não a margem nem o espaçamento de letras**. Isso produz o vão de cerca de 40 px entre título e descrição em `PageHeader` (Novo Produto, Nova Variante, Inventário Inicial, produto) e títulos "apertados" (Dashboard, Venda #…, Revisão da NF-e).
- `src/index.css:28`: `font: 18px/145%` na raiz faz **1rem valer 18 px**, então tudo do Tailwind fica 12,5 % maior (`text-sm` = 15,75 px, `p-6` = 27 px). Abaixo de 1024 px volta a 16 px (`:43`).
- Correção: remover o bloco do template (`:12-19, :28, :60-91, :98-…` `.counter`) e definir tipografia base em `@layer base`.

---

## Médio

**M1. Filtros e cartões de resumo colados na borda do cartão.** O contêiner dos filtros não tem padding lateral em `modules/sales/pages/SaleListPage.tsx:56-58`, `modules/purchases/pages/PurchaseListPage.tsx:88-90`, `modules/nfe-imports/pages/NfeImportListPage.tsx:127` e `modules/finance/pages/FinanceListPage.tsx:147-155` (os três cartões de resumo também). Em Produtos (`ProductListPage.tsx:79`) existe `p-5`, então o mesmo padrão aparece de dois jeitos.

**M2. Filtros truncados.** "Todas as marc", "Todas as categ" (`modules/products/pages/ProductListPage.tsx:98,111`, `sm:w-56` com ícone de busca, botão limpar e seta). "Todos os" em Fornecedor (Pedidos) e "Todos os cliente" (Contas). O placeholder da busca de produtos também corta.

**M3. Números centralizados nas listas.** Valores em dinheiro e quantidades usam `align: 'center'`: `useSaleColumns.tsx:55,62`, `FinanceListPage.tsx:55-57`, `PurchaseListPage.tsx:37`, `NfeImportListPage.tsx:74`. O preço das variantes fica à esquerda (`ProductVariantColumns.tsx`). Padrão recomendado: números à direita com `tabular-nums`, e texto e status à esquerda.

**M4. Cinco "botões primários" diferentes.** `bg-black` (23 usos, ex.: `shared/components/crud/CrudHeader.tsx:49`), `bg-gray-900` (9, modais), `bg-blue-500` (`components/ui/button.tsx:8`: Nova marca, Novo Cliente, Registrar venda), `bg-blue-600` (Registrar pagamento) e `bg-red-600` para uma ação **não destrutiva** ("Cenário Inicial", `modules/inventory/pages/InventoryListPage.tsx:44`). Na mesma tela de produto há "Novo Produto" preto e, em Marcas, "Nova marca" azul.

**M5. Três padrões de cabeçalho de página.** (a) Título dentro do cartão (`Section`/`CrudHeader`: listas). (b) Título solto no fundo com "Voltar" (`shared/components/layout/PageHeader.tsx:45`: produto, formulários). (c) Botão quadrado de voltar ao lado do título (`SaleCreatePage.tsx:224`, `PurchaseCreatePage.tsx:205`, `NfeImportReviewPage.tsx:63`). Os tamanhos variam entre `text-xl`, `2xl` e `3xl`, com pesos `semibold` e `bold`. `modules/products/components/ProductForm.tsx:61` deixa o título **cinza** (`text-gray-500`).

**M6. Larguras de conteúdo inconsistentes e sem limite em 1920.** Listas, dashboard e detalhes de venda, pedido e conta ocupam a largura toda (`shared/layouts/DashboardLayout.tsx:52`, sem `max-w`). Em 1920 a coluna "Qtd." fica a 700 px do nome do produto (`sale-detail-1920.png`). Formulários usam `max-w-3xl` centralizado (`PageContainer.tsx:6`), Nova Variante usa outra largura e Cliente usa `max-w-5xl` centralizado. Isso dá quatro alinhamentos diferentes de borda esquerda.

**M7. Páginas de detalhe sem superfície.** Venda, pedido e contas (`SaleDetailPage.tsx`, `PurchaseDetailPage.tsx`, `FinanceDetailPage.tsx`) e estoque (`InventoryDetailsPage.tsx`) põem texto, tabelas e totais direto no fundo cinza, sem cartões, enquanto o resto do app usa cartões brancos. A hierarquia fica fraca: o total em lilás tem o mesmo peso dos itens.

**M8. Menu lateral.** Em 900 px de altura, "Importar NF-e" aparece cortado pela metade. Em 800 px, Financeiro e Usuários ficam escondidos sem nenhuma indicação de rolagem (`components/Sidebar.tsx:69`). Não há divisória entre o menu e "Alterar senha/Sair". Os ícones do rodapé (`:84,96`, `px-6`) não alinham com os do menu (`:25,69`, `px-3`+`px-4`). Não mostra o nome nem o papel do usuário logado.

**M9. Quatro estilos de tabela.** `DataTable` (cabeçalho em caixa alta cinza sobre `gray-50`, `shared/components/table/DataTable.tsx:184`), `DetailTable` (negrito sem caixa alta, sem padding), itens da venda (texto normal, "Preço unitário" quebrando, `SaleCreatePage`) e lotes do estoque (`InventoryDetailsPage.tsx:153`, `bg-muted/40` que não existe).

**M10. Contadores redundantes e cartões de resumo desiguais.** "Total de marcas/clientes/fornecedores/usuários" aparece só em algumas listas, às vezes com ícone e às vezes sem. Outras listas usam "(23)" no título. No produto, a contagem de variantes aparece **três vezes** (`ProductDetailsPage.tsx:141-185`: grade, `SummaryCard` e título "Variantes (2)").

**M11. Paginação em dois formatos.** Em largura total (Produtos, Vendas) e recuada com margem (Marcas, Clientes, Usuários). Os botões não têm cor própria (herdam lilás) e o estado desabilitado usa `opacity-50` (`shared/components/crud/CrudPagination.tsx:152-177`, cerca de 2,1:1).

**M12. Inventário Inicial.** Há título duplicado: "Inventário Inicial" no `InitialInventoryHeader.tsx:9` e de novo dentro do cartão em `InitialInventoryStart.tsx:10`. Na etapa seguinte aparece um segundo `h1` gigante ("Cadastro do produto", `InitialInventoryProductChoice.tsx:14`). Os dois cartões de escolha têm alturas e alinhamento vertical diferentes, e os títulos estão em lilás (`InitialInventoryStart.tsx:16-26`).

**M13. Revisão da NF-e.** Valores das parcelas aparecem no formato americano "132.36". O botão "+ Adicionar parcela" quebra, com o ícone numa linha e o texto na outra. Os rótulos repetidos por parcela ficam desalinhados com "Nº 001". Os selects nativos têm fundo cinza, diferente dos campos (`NfeImportReviewPage.tsx`, `nfe-review-1440-full.png`).

**M14. Contrastes reprovados (detalhes na seção de cores).** Branco sobre `blue-500` (3,68:1) em todos os botões do `ui/Button`. Descrições `gray-500` sobre o fundo `slate-100` (4,41:1, `PageHeader.tsx:70`). Placeholders `gray-400` (2,54:1). Rodapé do login (2,56:1). Pagamento estornado (2,32:1). "Excluir" vermelho sobre o fundo (4,41:1).

**M15. Ações indisponíveis mostradas como botões apagados.** "Registrar pagamento" aparece em parcela já paga (`modules/finance/pages/FinanceDetailPage.tsx:107-108`, azul a 50 %). "Adicionar" fica preto a 50 %, parecendo cinza-chumbo (`modules/sales/components/SaleBarcodeInput.tsx:79`).

**M16. Lista de estoque.** O título é "Itens (23)", enquanto o menu diz "Estoque". Não há busca. O status "Reservado" aparece para item com 40 disponíveis. Quantidades vêm em pílulas azuis, inclusive 0 (`useInventoryColumns.tsx:9-60`).

---

## Baixo

- **B1.** A fonte Geist é importada (`index.css:3`), mas nunca usada: `--sans` é `system-ui` (`:20`) e o `body` usa o `font-sans` padrão. Ou usar a Geist, ou remover o import.
- **B2.** CSS morto do template: `src/App.css` (184 linhas, não importado), `.counter`, `--accent` roxo e `--code-bg` (`index.css:15-19, 98+`).
- **B3.** Botão "📷 Ler" depende de emoji, que vira quadrado sem fonte de emoji (`modules/products/components/VariantForm.tsx:154`, `modules/inventory/components/InitialInventoryScanner.tsx:52`). Usar o ícone `Camera` do lucide, como no "Escanear".
- **B4.** `h-15 w-15` não existe no Tailwind 3 (`CustomerDetailsPage.tsx:59`), então o círculo do avatar colapsa. "Cliente #" mostra o UUID inteiro (`:66`).
- **B5.** Links "Venda de origem", "Pedido PC000012" e "Ver contas a receber" parecem texto comum: cinza, sem sublinhado nem ícone (`FinanceDetailPage.tsx:65`, `SaleDetailPage`).
- **B6.** O título do modal de pagamento quebra em duas linhas ("Registrar pagamento — / parcela 2") por causa de `pr-8` e da largura `md` (`Modal.tsx:80`).
- **B7.** Raios e sombras misturados: `rounded` 11 · `-md` 14 · `-lg` 224 · `-xl` 57 · `-2xl` 2 usos. `shadow` 29, `shadow-sm` 12 e mais 4 outros níveis. Cartões ora com borda, ora com sombra, ora com os dois.
- **B8.** Família de cinzas misturada: `gray` 430 usos contra `slate` 27 (menu, login e o fundo `bg-slate-100` do `<main>`). Cinco "quase pretos" diferentes: `#08060d` (h1/h2 do template), `#111827`, `#1f2937`, `#0f172a` e `#000`.
- **B9.** Estados de carregamento inconsistentes: texto solto "Carregando..." (`DashboardLayout.tsx:55`, `ProductDetailsPage.tsx:224`, `InventoryDetailsPage.tsx:24`) contra o skeleton do dashboard (`DashboardPage.tsx:79-82`).
- **B10.** Campos de data nativos seguem o idioma do navegador (em Chrome configurado em inglês aparece `mm/dd/yyyy`). É aceitável, mas vale padronizar se houver usuários com navegador em inglês.
- **B11.** Escala tipográfica solta: 7 tamanhos (`text-sm` 339 usos, `xs` 48, `lg` 28, `xl` 21, `2xl` 16, `3xl` 6, `base` 5) e pesos `medium` 164, `semibold` 60, `bold` 20, sem regra de quando usar cada um.

---

## Cores e tipografia

### Cores de texto em uso (código-fonte, `.tsx` sem testes)
| Família | Usos | Observação |
|---|---|---|
| `text-gray-500` | 157 | Descrições e rótulos. Reprova sobre o fundo `slate-100`. |
| `text-gray-700` / `-600` / `-800` / `-900` | 37 / 28 / 8 / 10 | Quatro tons para "texto principal". |
| `text-gray-400` | 23 (+4 `placeholder:`) | Placeholders e "Sem estoque". Sempre reprova. |
| `text-slate-*` | 10 | Menu e login. |
| sem classe (herda `#6b6375`) | cerca de 260 nós medidos | Valores, células, campos, paginação. |
| `#08060d` via `h1`/`h2` globais | títulos | Quase preto com tom roxo do template. |
| cores de status (`red`, `green`, `amber`, `blue`) | 236 / 11 / 18 / 48 | `red` inclui fundos e bordas de erro. |

Total de classes de cor crua: **916 em 84 de 127 arquivos `.tsx`** (66 %). Classes `dark:` em uso: **0**.

### Pares problemáticos (medidos no navegador)
| Texto | Fundo | Contraste | Mínimo | Onde |
|---|---|---|---|---|
| `#ffffff` | `#ffffff` | **1,00** | 4,5 | Botão "Editar" do cliente (A2) e rótulos/Cancelar do modal Alterar senha (A1) |
| `#9ca3af` (gray-400) | `#f1f5f9` | **2,32** | 4,5 | Pagamento estornado riscado (`FinanceDetailPage`) |
| `#9ca3af` (gray-400) | `#ffffff` | **2,54** | 4,5 | Placeholders, "Atualizando...", "Sem estoque" (`VariantStock.tsx:24`) |
| `#94a3b8` (slate-400) | `#ffffff` | **2,56** | 4,5 | Rodapé "© 2026 Inventory System" (login) |
| `#6b6375` a 50 % | `#ffffff` | **≈2,1** | — (desabilitado) | "Anterior"/"Próxima" desabilitados |
| `#ffffff` | `#3b82f6` (blue-500) | **3,68** | 4,5 | Nova marca, Nova categoria, Novo Cliente, Novo fornecedor, Novo usuário, Registrar venda, Confirmar importação |
| `#ef4444` (red-500) | `#ffffff` | **3,76** | 3,0 (símbolo) / 4,5 | Asterisco de obrigatório. Passa como símbolo, mas é reprovado se usado em texto. |
| `#6b7280` (gray-500) | `#f1f5f9` | **4,41** | 4,5 | Descrições de página fora de cartão (`PageHeader.tsx:70`), "Código P000123", subtítulos (100 nós) |
| `#dc2626` (red-600) | `#f1f5f9` | **4,41** | 4,5 | "Excluir" no produto, texto "Estornado em…" |
| `#6b7280` (gray-500) | `#f9fafb` | 4,63 | 4,5 | Cabeçalho do DataTable (12 px em caixa alta). Passa raspando. |
| `#15803d` | `#dcfce7` | 4,57 | 4,5 | Badge "Ativo". Passa raspando. |
| `#6b6375` | `#ffffff` / `#f1f5f9` | 5,73 / 5,23 | 4,5 | Passa, mas é a cor "apagada" e destoante (A8) |

### Tipografia
- A raiz de 18 px (`index.css:28`) infla toda a escala. A recomendação é voltar a 16 px no desktop, com `text-sm` (14 px) para tabelas e formulários.
- Proposta de escala: título de página `text-2xl font-semibold`; título de cartão `text-base font-semibold`; rótulo `text-sm font-medium`; corpo `text-sm`; legenda `text-xs`; valor de KPI `text-2xl font-semibold tabular-nums`.
- Números em tabelas e totais devem usar `tabular-nums` e alinhamento à direita.

---

## Temas

### Situação atual
- O `tailwind.config.ts` tem 7 cores mapeadas para variáveis, mas as variáveis são as do template (`--foreground: #6b6375`, `--border: #e5e4e7`), e `--ring`, `--input` e `--primary` **nem estão definidas** em `index.css`.
- Quase nada usa token: 22 usos, metade com classes inexistentes. Não há `darkMode` no config, nem `dark:`, nem leitura de `prefers-color-scheme`.
- `index.html` tem `<meta name="theme-color" content="#0f172a">` fixo.

### Conjunto de tokens proposto
Formato recomendado: canais RGB em variáveis CSS (`--surface: 255 255 255`) e, no Tailwind, `surface: 'rgb(var(--surface) / <alpha-value>)'`. Assim continuam funcionando modificadores como `bg-primary/10`. Os contrastes abaixo foram calculados.

| Token | Uso | Claro | Escuro | Contraste (claro / escuro) |
|---|---|---|---|---|
| `background` | fundo da área de conteúdo | `#f1f5f9` | `#020617` | — |
| `surface` | cartões, modais, tabelas | `#ffffff` | `#0f172a` | — |
| `surface-muted` | cabeçalho de tabela, hover, zebra | `#f8fafc` | `#1e293b` | — |
| `border` | bordas e divisórias | `#e2e8f0` | `#1e293b` | — |
| `input` | borda de campo | `#cbd5e1` | `#334155` | — |
| `text` (`foreground`) | texto principal e valores | `#0f172a` | `#f1f5f9` | 17,85 na surface / 16,3 na surface |
| `text-muted` | rótulos, descrições, cabeçalhos | `#475569` | `#94a3b8` | 6,92 no background · 7,58 na surface / 6,96 na surface · 5,71 no surface-muted |
| `text-subtle` | placeholder, dicas (só sobre `surface`) | `#64748b` | `#7c8aa0` | 4,76 / 5,10 |
| `primary` | ação principal, links, gráfico | `#2563eb` | `#60a5fa` | — |
| `primary-foreground` | texto sobre primary | `#ffffff` | `#0f172a` | 5,17 / 7,02 |
| `primary-hover` | hover | `#1d4ed8` | `#93c5fd` | 6,70 / — |
| `success` / `success-soft` | texto ou ícone / fundo do badge | `#15803d` / `#dcfce7` | `#4ade80` / `#052e16` | 4,57 / 8,55 |
| `warning` / `warning-soft` | | `#b45309` / `#fef3c7` | `#fcd34d` / `#451a03` | 4,51 / 10,39 |
| `danger` / `danger-soft` | erro, destrutivo, vencido | `#b91c1c` / `#fee2e2` | `#f87171` / `#450a0a` | 6,47 na surface · 5,30 no soft / 6,45 · 8,51 (`#fca5a5` no soft) |
| `danger-solid` + `danger-foreground` | botão Excluir | `#dc2626` + `#ffffff` | `#f87171` + `#0f172a` | 4,83 / 6,45 |
| `info` / `info-soft` | badges neutros e informativos | `#1d4ed8` / `#dbeafe` | `#93c5fd` / `#172554` | 5,49 / 8,15 |
| `ring` | foco (`focus-visible:ring-2`) | `#2563eb` | `#60a5fa` | ≥3:1 contra a surface |
| `sidebar` / `sidebar-foreground` / `sidebar-muted` / `sidebar-active` | menu lateral | `#0f172a` / `#f1f5f9` / `#94a3b8` / `#1e293b` | `#020617` / `#f1f5f9` / `#94a3b8` / `#1e293b` | 16,3 / 18,4; muted 6,96 / 7,87 |
| `overlay` | fundo de modal | `2 6 23 / 0.5` | `0 0 0 / 0.6` | — |
| `chart-1…6` | séries de gráfico | `#2563eb #0d9488 #d97706 #db2777 #7c3aed #64748b` | `#60a5fa #2dd4bf #fbbf24 #f472b6 #a78bfa #94a3b8` | Validar com a skill de dataviz antes do uso. Hoje só há uma série (`SalesChart`). |

Tokens auxiliares: `--radius` (8 px para controles, 12 px para cartões), `--shadow-card` (no escuro, troca-se a sombra por borda) e `color-scheme: light | dark` em `:root` para que campos nativos (data, select, barra de rolagem) acompanhem o tema.

### Implementação
1. **CSS** (`src/index.css`, `@layer base`): `:root { …claro… }`, `:root[data-theme="dark"] { …escuro… }` e `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { …escuro… } }`. Assim "seguir o sistema" funciona até sem JavaScript. Remover todo o bloco do template.
2. **Tailwind** (`tailwind.config.ts`): `darkMode: ['class', '[data-theme="dark"]']` e `theme.extend.colors` com os tokens acima, no formato `rgb(var(--x) / <alpha-value>)`. Opcionalmente, restringir `theme.colors` para impedir cores cruas no futuro, ou adicionar uma regra de lint (grep no CI por `-(gray|slate|blue|red|green|amber)-\d{3}`).
3. **Preferência e persistência**: as opções são `light | dark | system`, gravadas em `localStorage['ui.theme']`. É uma preferência por navegador, válida para quem usa o computador. Para valer por usuário entre dispositivos, salvar também no perfil (backend) e sincronizar após o `/users/me`. Um store `zustand` (`useThemeStore`) aplica `document.documentElement.dataset.theme`, escuta `matchMedia('(prefers-color-scheme: dark)')` quando a opção é `system` e atualiza `<meta name="theme-color">`.
4. **Sem flash no carregamento**: um `<script>` inline no `<head>` do `index.html`, antes do CSS, lê `localStorage['ui.theme']` dentro de `try/catch` e define `data-theme` e `style.colorScheme` antes da primeira pintura. Como o `<meta theme-color>` também pode ser ajustado ali, a barra do celular acompanha o tema.
5. **Seletor**: colocar no rodapé do menu, junto de "Alterar senha", com três opções (Claro, Escuro, Seguir o sistema) e ícones `Sun`, `Moon` e `Monitor`.

### Tamanho da migração
- **Volume:** 916 classes de cor crua em 84 arquivos, mais os pontos que herdam cor do template. Cerca de 40 % estão em 12 componentes compartilhados: `Modal`, `DataTable`, `DetailTable`, `Section`, `PageHeader`, `CrudHeader`, `CrudBadge`, `CrudPagination`, `CrudActions`, `Sidebar`, `ui/button`, `form/*` (Autocomplete, EntitySearchSelect, MoneyInput, QuantityInput).
- **Estimativa (1 pessoa):**
  - Base: tokens, config, script anti-flash, store, seletor e limpeza do `index.css`. **0,5–1 dia.**
  - Componentes compartilhados, incluindo `Button`/`Badge` com variantes e `cn()`. **1–1,5 dia.**
  - Módulos (cerca de 70 arquivos restantes; o trabalho é em grande parte mecânico: `text-gray-500` vira `text-muted`, `bg-white` vira `bg-surface`, `bg-black` vira `bg-primary`, `border-gray-200` vira `border-border`, `text-red-600` vira `text-danger`). **2–3 dias.**
  - Revisão visual nos dois temas e nas três larguras, mais o mobile, refazendo as capturas com o mesmo script. **1 dia.**
  - **Total: cerca de 5–6 dias-pessoa**, ou cerca de 4 se as correções de layout já tiverem passado pelos componentes compartilhados.

---

## Ordem recomendada de trabalho

| # | O quê | Itens | Tamanho |
|---|---|---|---|
| 1 | Bugs de visibilidade: portal no `Modal` e `cn()` no `Button` | A1, A2 | P (2–3 h) |
| 2 | Limpar o CSS do template (cor padrão, `h1/h2`, raiz 18 px, `App.css`) e definir tipografia base | A8 (parte), A9, B1, B2, B11 | P (meio dia), com mudança visual ampla: conferir as telas |
| 3 | Fundação de tokens e temas (CSS vars, Tailwind, anti-flash, store, seletor) sem migrar telas ainda | Temas 1–5 | P–M (0,5–1 dia) |
| 4 | Componentes compartilhados com tokens e variantes: `Badge` com cores de status, `Button` primário único, `DetailTable` com padding, `CrudPagination`, `DataTable` com números à direita, `Section` | A3, A6, A7, M3, M4, M9, M11, M14 | M (1–1,5 dia) |
| 5 | Layout: rolagem de página no desktop (remover altura fixa de `Page`/`Section`), largura máxima do conteúdo, padding dos filtros, larguras dos filtros, menu com rolagem visível | A4, M1, M2, M6, M8 | M (1 dia) |
| 6 | Dashboard (grade dos KPIs, valores, cores) | A5 | P (2–3 h) |
| 7 | Padronizar cabeçalhos de página e detalhes em cartões (venda, pedido, contas, estoque) | M5, M7, M10, M12, M16 | M (1 dia) |
| 8 | Migrar as cores restantes dos módulos para tokens e ativar a regra de lint | Temas | M–G (2–3 dias) |
| 9 | Pequenos ajustes (NF-e, emoji, links, avatar, carregamento, ações desabilitadas) | M13, M15, B3–B10 | P (meio dia) |
| 10 | QA visual nos temas claro e escuro, 1280/1440/1920 e mobile | — | P–M (1 dia) |

Total aproximado: **8–10 dias-pessoa** para layout, cores e temas completos. Os passos 1, 2 e 6 sozinhos (cerca de 1 dia) já resolvem a maior parte do que o usuário percebe hoje.
