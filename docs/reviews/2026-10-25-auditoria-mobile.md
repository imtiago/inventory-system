# Auditoria de uso em celular e tablet: frontend (inventory-system)

Data: 2026-10-25. Escopo: `frontend/` (React 19 + Vite 8). Análise feita só pelo código, sem testes em navegador ou aparelho real. Os pontos marcados "verificar no aparelho" dependem do comportamento do navegador.

## Contexto técnico

- **Estilo:** Tailwind CSS 3.4 (`tailwind.config.ts`), com componentes próprios no estilo shadcn em `src/components/ui/*` (botão, input, select e tabela simples, sem Radix na prática). Não há CSS modules nem biblioteca de UI. O CSS global fica em `src/index.css`. O `src/App.css` existe, mas não é importado em lugar nenhum (código morto).
- **Breakpoints:** quase não há uso de `sm:`/`md:`/`lg:` no shell (layout, menu, cabeçalhos, paginação). Onde aparecem, estão em páginas mais novas (venda, compra, NF-e, dashboard, filtros). O hook `src/shared/hooks/useIsMobile.ts:1-3` existe, mas não é usado e não reage a mudança de tamanho.
- **Larguras de referência:** celular de 360–430 px em retrato; tablet de 768–1024 px.

### 1. Base (index.html e CSS global)

| Item | Situação | Evidência |
|---|---|---|
| Meta viewport | OK (`width=device-width, initial-scale=1.0`, sem bloquear zoom) | `index.html:5` |
| `lang` / título | `lang="en"` com conteúdo em português; título "frontend" | `index.html:2`, `index.html:6` |
| box-sizing | OK (`* { box-sizing: border-box }`) | `src/index.css:134-136` |
| overflow-x | `html, body { overflow-x: hidden }` (esconde rolagem lateral, mas também esconde conteúdo que vaza) | `src/index.css:126-132` |
| Fonte base | 18px acima de 1024px e 16px até 1024px | `src/index.css:28`, `:39-43` |
| Inputs ≥16px | Não garantido: o preflight do Tailwind faz o input herdar a fonte, e muitos inputs usam `text-sm` (14px), o que faz o iOS dar zoom ao focar (ver M2) | |
| Dark mode | `color-scheme: light dark` e cores trocadas no modo escuro, mas os tokens `--background`/`--foreground` usados pelo Tailwind não estão definidos (ver A8) | `src/index.css:30`, `:46-60`, `:71` |

---

## ALTO: inutilizável ou bloqueante em celular/tablet

### A1. Menu lateral fixo de 256px, sem hambúrguer nem breakpoint
- **Onde:** `src/components/Sidebar.tsx:51` (`w-64`, sempre visível) e `src/shared/layouts/DashboardLayout.tsx:10-26` (`flex` em linha e `main` com `p-6`, linha 23). Não existe barra superior, botão de menu, nem `hidden md:flex`.
- **Problema:** em um celular de 390px, o menu ocupa 256px e sobram cerca de 134px para o `<main>`. Tirando o padding de 24px de cada lado, ficam aproximadamente 86px de conteúdo. Em tablet retrato (768px) sobram cerca de 464px úteis.
- **Impacto:** o estoquista no celular praticamente não consegue usar nenhuma tela. O vendedor em tablet retrato fica apertado, e quase toda tabela vira rolagem lateral.
- **Sugestão:** abaixo de `lg` (1024px), esconder o `<aside>` e mostrar uma barra superior com botão hambúrguer que abre o menu como gaveta sobreposta (overlay e foco presos, fechando ao navegar). Acima disso, manter o menu fixo, de preferência recolhível só com ícones em tablet paisagem. Reduzir o padding do main para `p-3 sm:p-4 lg:p-6`.

### A2. Menu sem rolagem: itens finais e "Sair" ficam cortados em telas baixas
- **Onde:** `src/components/Sidebar.tsx:52` (`h-screen`) e `:61` (`<nav className="flex-1 px-3">` sem `overflow-y-auto`). O pai tem `overflow-hidden` em `src/shared/layouts/DashboardLayout.tsx:13-14`.
- **Problema:** um admin vê 13 itens e 4 títulos de grupo, mais o título e os botões "Alterar senha" e "Sair" (`Sidebar.tsx:72-95`). Isso soma cerca de 1000px de altura. Celular em pé (cerca de 650–800px úteis), tablet deitado (cerca de 700px) e até notebook de 768px cortam o fim do menu sem permitir rolar.
- **Impacto:** em tablet paisagem e celular, não dá para chegar a "Contas a pagar", "Usuários", "Alterar senha" ou "Sair".
- **Sugestão:** `nav` com `min-h-0 overflow-y-auto`, e trocar `h-screen` por `h-dvh`. Isso também se resolve junto com a gaveta de A1.

### A3. Layout de altura fixa: listas e detalhes somem quando o topo fica alto (sem rolagem da página)
- **Onde:** `src/shared/components/layout/Page.tsx:11-18` (`h-full overflow-hidden`) e `src/shared/components/details/Section.tsx:27` e `:58` (`overflow-hidden`). A página inteira nunca rola: só a área da tabela tem rolagem própria.
  - `src/modules/finance/pages/FinanceListPage.tsx:142-214`: no celular, 3 cards de resumo, 4 filtros empilhados, um checkbox e textos ocupam cerca de 700px antes da tabela. A div da tabela (`flex-1 overflow-x-auto`, linha 199) é espremida até altura zero, e a paginação passa a ser cortada pelo `overflow-hidden` da Section.
  - `src/modules/products/pages/ProductDetailsPage.tsx:102-110` e `:141-176`: cabeçalho, seção de informações e card de resumo usam `shrink-0`. A seção de variantes (`flex-1`) fica sem altura em celular ou tablet deitado.
  - O mesmo padrão aparece em `src/modules/sales/pages/SaleListPage.tsx:51-102` (filtros sem padding dentro da Section), `src/modules/purchases/pages/PurchaseListPage.tsx:86-168` (5 filtros empilhados) e `src/modules/nfe-imports/pages/NfeImportListPage.tsx:126-168`.
- **Problema:** a lógica de "só a tabela rola" supõe uma tela de desktop alta. Com os filtros empilhados no celular, ou com o teclado aberto, o conteúdo útil fica invisível e não há como rolar até ele.
- **Impacto:** o financeiro no celular não vê a lista de contas a receber/pagar. Ninguém vê as variantes de um produto em celular ou tablet deitado.
- **Sugestão:** abaixo de `lg`, deixar a página rolar normalmente (`Page`: `lg:h-full lg:overflow-hidden`, e `Section`: `lg:overflow-hidden`), mantendo a rolagem interna só no desktop. Recolher os filtros num botão "Filtros" (painel ou gaveta) no celular.

### A4. Cabeçalhos de seção e paginação não quebram linha: botões cortados
- **Onde:**
  - `src/shared/components/details/Section.tsx:32-41`: `p-6 flex justify-between items-center` sem `flex-wrap`, dentro de `overflow-hidden`.
  - `src/modules/inventory/pages/InventoryListPage.tsx:32-46`: "Exportar CSV", "Novo" e "Cenário Inicial" lado a lado (cerca de 500px no total). "Cenário Inicial", que é a porta de entrada do inventário inicial, é o primeiro a ser cortado.
  - `src/modules/sales/pages/SaleListPage.tsx:41-48`: dois botões de exportar e "Nova Venda" (cerca de 520px). "Nova Venda" fica cortado já no tablet retrato.
  - `src/shared/components/crud/CrudPagination.tsx:19-63`: "Total", "Página X de Y", "Anterior" e "Próxima" numa linha sem quebra (cerca de 400px). "Próxima" sai da tela num celular de 360–390px.
- **Impacto:** o vendedor no tablet em pé não alcança "Nova Venda". O estoquista no celular não alcança "Cenário Inicial". Ninguém pagina no celular.
- **Sugestão:** `flex-wrap gap-3` nos cabeçalhos. No celular, concentrar as ações secundárias (exportar) num menu "⋯" e deixar a ação principal como botão grande ou flutuante. Na paginação, `flex-wrap` e ocultar "Total" e "Página X de Y" em telas `< sm` (ou usar só setas com `aria-label`).

### A5. Câmera exige HTTPS e nada trata ou explica isso
- **Onde:**
  - `src/components/BarcodeScanner.tsx:36-74`: qualquer falha vira "Não foi possível acessar as câmeras." (linha 67). Não há checagem de `window.isSecureContext` nem de `navigator.mediaDevices`, e `NotAllowedError` (permissão negada), `NotFoundError` e `NotReadableError` (câmera em uso) não são diferenciados.
  - `package.json:7` (`vite --host`, servindo em http://IP-da-rede) e `src/shared/services/api.ts:9` (API padrão `http://localhost:3000`, que no celular aponta para o próprio celular; a linha 8 comentada mostra que já se tentou o IP da rede).
- **Problema:** em `http://192.168.x.x`, o Chrome e o Safari do celular não expõem `getUserMedia`, então a câmera nunca abre. Com o frontend em HTTPS e a API em HTTP, as chamadas falham por mixed content. A mensagem não diz o que fazer.
- **Impacto:** no armazém, o estoquista não consegue ler códigos pelo celular. Na prática, o caso de uso principal pedido não funciona fora de `localhost`.
- **Sugestão:**
  1. Testar `window.isSecureContext` e `navigator.mediaDevices?.getUserMedia` antes de carregar a lib, e exibir: "A câmera só funciona em conexão segura (https). Peça ao administrador o endereço https do sistema."
  2. Dar mensagens específicas para permissão negada (com instrução de reativar nas configurações do navegador) e para câmera em uso, com um botão "Tentar novamente".
  3. Em dev, usar `@vitejs/plugin-basic-ssl` ou mkcert com `server.https`, e um proxy `/api` no Vite para evitar mixed content e CORS. Em produção, documentar que é obrigatório HTTPS no frontend e na API.

### A6. Inventário inicial: campo de código de barras somente leitura (sem câmera, sem saída)
- **Onde:** `src/modules/inventory/components/InitialInventoryScanner.tsx:19` (`<input value={barcode} readOnly ...>`). A única forma de preencher é a câmera (`:21`, "📷 Ler").
- **Problema:** sem câmera, seja por falta de HTTPS (A5), permissão negada ou câmera ruim, não dá para digitar o código. Leitores Bluetooth ou USB, que funcionam como teclado e são comuns em armazém, também não conseguem escrever num campo `readOnly`. O caminho alternativo, "Cadastrar sem código de barras", perde o vínculo com o código. Compare com `src/modules/sales/components/SaleBarcodeInput.tsx:52-61`, onde o campo é editável e tem botão "Adicionar".
- **Impacto:** o estoquista com celular sem câmera utilizável ou com leitor externo fica travado no fluxo principal do inventário.
- **Sugestão:** reutilizar o padrão do `SaleBarcodeInput` (campo editável, Enter ou "Buscar", e "Escanear"), com `inputMode="numeric"` opcional (Code128 aceita letras) e `enterKeyHint="search"`.

### A7. Tabela de lotes no detalhe do estoque corta colunas (sem rolagem lateral)
- **Onde:** `src/modules/inventory/pages/InventoryDetailsPage.tsx:110-111` (`<div className="overflow-hidden rounded-lg border"><table className="w-full">` com 6 colunas).
- **Problema:** o `overflow-hidden` corta o que passa da largura. No celular, "Custo" e "Validade" ficam invisíveis e não há como rolar até elas. Além disso, a grade de cards só vira 4 colunas a partir de `sm` (`:72`).
- **Impacto:** o estoquista consultando um item no celular não vê validade nem custo dos lotes.
- **Sugestão:** trocar para `overflow-x-auto` como medida mínima. O ideal é um card por lote no celular (lote e validade em destaque; recebido, restante e em caixas em linha).

### A8. Celular em modo escuro: títulos quase brancos sobre fundo branco e texto cinza-claro
- **Onde:**
  - `src/index.css:30` (`color-scheme: light dark`) e `:46-60` (no escuro, `--text-h: #f3f4f6` e `--text: #9ca3af`).
  - `src/index.css:74-79`: todo `h1`/`h2` recebe `color: var(--text-h)`.
  - `src/index.css:71` (`bg-background text-foreground`): `--background` e `--foreground` não estão definidos em lugar nenhum (`tailwind.config.ts`), então o texto herda `--text`.
  - Títulos sem cor própria, por exemplo: `src/shared/components/layout/PageHeader.tsx:45`, `src/shared/components/ConfirmDialog.tsx:77`, `src/modules/inventory/components/InitialInventoryHeader.tsx:9`, `src/modules/sales/pages/SaleCreatePage.tsx:208`, `src/modules/products/components/VariantForm.tsx:80`.
- **Problema:** com o celular em modo escuro, configuração automática comum à noite, os títulos ficam #f3f4f6 sobre cartões brancos (invisíveis) e o texto do corpo fica #9ca3af sobre branco (contraste de cerca de 2,5:1). Inputs nativos sem `bg-white` (por exemplo, `src/modules/products/components/ProductForm.tsx:77`) ficam escuros dentro de cartões brancos. Também afeta desktop em modo escuro, mas no celular é bem mais frequente.
- **Impacto:** todos os usuários de celular ou tablet com tema escuro.
- **Sugestão:** como correção rápida, remover `color-scheme: light dark` e o bloco `prefers-color-scheme` (assumir só tema claro), e definir `--background`/`--foreground`. Um tema escuro de verdade fica para depois.

---

## MÉDIO: usável, mas sofrido

### M1. Todas as listas são tabelas largas, sem layout em cartões; as ações ficam na última coluna
- **Onde:** `src/shared/components/table/DataTable.tsx:11-12` (só `overflow-x-auto`, com `px-5 py-4` por célula em `:19`/`:31`). Usado em produtos, variantes, estoque, vendas, clientes, fornecedores, compras, receber/pagar, NF-e, usuários, marcas e categorias. As ações ficam na última coluna: `src/modules/products/hooks/useProductColumns.tsx:76-100`, `src/modules/products/components/ProductVariantColumns.tsx:66-87` e "Ver conta" em `src/modules/finance/pages/FinanceListPage.tsx:62-71`. Bug à parte: a mensagem de vazio diz "Nenhum cliente encontrado" para qualquer entidade (`DataTable.tsx:46-48`).
- **Problema:** a rolagem lateral funciona, mas no celular editar, excluir ou "Ver conta" exige arrastar a tabela para o lado, e cada linha ocupa muito espaço.
- **Impacto:** todos os perfis no celular; vendedor e financeiro no tablet retrato.
- **Sugestão:** acrescentar ao `DataTableColumn` um `mobile?: 'title' | 'subtitle' | 'meta' | 'hidden'` e, abaixo de `md`, renderizar uma lista de cartões (linha inteira clicável para o detalhe e ações num menu "⋯" com alvos de 44px). Sai uma vez no `DataTable` e vale para as 12+ listas.

### M2. Inputs com fonte de 14px: o iOS dá zoom ao focar
- **Onde (inputs com `text-sm`):**
  - `src/shared/components/form/Autocomplete.tsx:179` (todos os autocompletes: cliente da venda, fornecedor, marca, categoria)
  - `src/shared/components/NamedEntityPage.tsx:162`
  - `src/modules/products/pages/ProductListPage.tsx:91`
  - `src/modules/finance/pages/FinanceListPage.tsx:126`
  - `src/modules/purchases/pages/PurchaseListPage.tsx:21`
  - `src/modules/finance/components/RegisterPaymentModal.tsx:30`
  - `src/modules/purchases/components/ReceivePurchaseModal.tsx:19`
  - `src/modules/nfe-imports/components/NfeItemCard.tsx:10`
  - `src/modules/nfe-imports/pages/NfeImportReviewPage.tsx:31`
  - `src/modules/nfe-imports/pages/NfeImportListPage.tsx:18`
  - `src/modules/sales/pages/SaleListPage.tsx:57`, `:63`, `:74`
  - Campos de quantidade e preço dentro de tabelas `text-sm`: `src/modules/sales/pages/SaleCreatePage.tsx:296`/`:316-325` e `src/modules/purchases/pages/PurchaseCreatePage.tsx:269`/`:37`
- **Problema:** o Safari do iPhone e do iPad amplia a página ao focar campos com menos de 16px e não volta sozinho, deixando o layout deslocado.
- **Impacto:** usuários de iPhone/iPad em praticamente todo formulário ou filtro.
- **Sugestão:** usar `text-base sm:text-sm` nos inputs, ou uma regra global `@media (max-width: 767px) { input, select, textarea { font-size: 16px } }`.

### M3. Grades que não colapsam no celular
- **Onde:** `src/shared/components/details/DetailsGrid.tsx:14` (`grid-cols-4` fixo, usado em `src/modules/products/pages/ProductDetailsPage.tsx:147`) e `src/modules/products/components/ProductForm.tsx:99` (`grid-cols-2` fixo, com marca e categoria autocomplete lado a lado, cerca de 140px cada no celular). O `ProductForm` também é usado no modal do inventário inicial (`src/modules/inventory/components/InitialInventoryNewProduct.tsx:27`).
- **Impacto:** o estoquista cadastrando produto novo no celular durante o inventário inicial fica com campos estreitos demais para ler o que selecionou.
- **Sugestão:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` e `grid-cols-1 sm:grid-cols-2`.

### M4. Itens de venda e de compra em tabela com largura mínima
- **Onde:** `src/modules/sales/pages/SaleCreatePage.tsx:295-347` (`min-w-[600px]`: quantidade, preço, subtotal e lixeira) e `src/modules/purchases/pages/PurchaseCreatePage.tsx:268-337` (`min-w-[860px]`, com 4 campos de dinheiro por linha). O detalhe da compra (`src/modules/purchases/pages/PurchaseDetailPage.tsx:97`, `min-w-[720px]`) rola, o que é aceitável para leitura.
- **Problema:** no celular e no tablet retrato, para mudar a quantidade ou remover um item é preciso rolar a tabela para o lado. A lixeira fica fora da tela. O resto da tela de venda já é responsivo (`max-w-4xl`, `flex-col sm:flex-row`), só o carrinho não.
- **Impacto:** vendedor no tablet retrato ou celular; comprador no tablet.
- **Sugestão:** abaixo de `md`, mostrar cada item como cartão: nome e código; stepper de quantidade [−] [n] [+] com 44px; preço e subtotal; botão remover. A compra segue o mesmo padrão, com os campos de dinheiro em grade de 2 colunas dentro do cartão.

### M5. Teclado errado em campos de quantidade e dinheiro
- **Onde:**
  - **Quantidade sem `inputMode`:** `src/modules/sales/pages/SaleCreatePage.tsx:318`, `src/modules/purchases/pages/PurchaseCreatePage.tsx:296`, `src/modules/purchases/components/ReceivePurchaseModal.tsx:110`, `src/modules/inventory/components/InventoryLotForm.tsx:152`, `src/modules/nfe-imports/components/NfeItemCard.tsx:114`.
  - **Dinheiro com `type="number"`:** custo do lote sem `inputMode` em `src/modules/inventory/components/InventoryLotForm.tsx:119`. Com `inputMode="decimal"`, mas ainda `type="number"`: `src/modules/products/components/VariantForm.tsx:156-158` (placeholder "0,00"), `src/modules/purchases/pages/PurchaseCreatePage.tsx:309-312`, `src/modules/nfe-imports/pages/NfeImportReviewPage.tsx:254`, `src/modules/inventory/components/ProductVariantRegistration.tsx:110-112`.
  - **Exceção correta:** `src/modules/finance/components/RegisterPaymentModal.tsx:84-85` usa `type="text" inputMode="decimal"`.
- **Problema:** sem `inputMode`, o iOS mostra o teclado completo. Com `type="number"`, a vírgula decimal do teclado pt-BR pode ser rejeitada ou zerar o valor, dependendo de navegador e versão (verificar no aparelho). O placeholder "0,00" induz a digitar vírgula. O stepper nativo e a roda do mouse alteram valores sem querer.
- **Sugestão:** quantidades com `inputMode="numeric" pattern="[0-9]*"`. Dinheiro com `type="text" inputMode="decimal"` e parse aceitando vírgula, com um componente `MoneyInput` único, igual ao do pagamento.

### M6. Scanner: escolha da câmera, tamanho da área de leitura, lanterna e leitura contínua
- **Onde:** `src/components/BarcodeScanner.tsx`.
  - **`:61-63`:** a câmera traseira é escolhida pelo nome (regex "back|rear|traseira"). Em celulares com várias câmeras traseiras pode cair na ultra-wide, que não foca de perto e lê mal códigos pequenos. Também não se usa `{ facingMode: 'environment' }`, que o `start()` do html5-qrcode aceita.
  - **`:115-118`:** `qrbox` fixo de 300×120 px. Em telas estreitas a caixa ocupa a largura inteira ou passa do vídeo. O ideal é uma função baseada no tamanho do visor (por exemplo, 80% × 35%).
  - **Lanterna:** não há. Armazém costuma ter pouca luz, e html5-qrcode oferece `applyVideoConstraints({ advanced: [{ torch: true }] })` quando `getRunningTrackCapabilities().torch` existe. Sem a lanterna, a leitura em local escuro falha.
  - **Sem leitura contínua:** a venda fecha a câmera a cada leitura (`src/modules/sales/components/SaleBarcodeInput.tsx:34-35`). Para 10 itens, são 10 vezes "Escanear" e 10 inicializações de câmera. Também não há bipe ou vibração (`navigator.vibrate`) confirmando a leitura.
  - **Erros:** os estados de erro e de carregamento (`:183-196`) são texto simples, sem "Tentar novamente".
  - **`:130`:** `console.log` de cada código lido.
- **Impacto:** o estoquista e o vendedor perdem tempo, e a leitura falha em pouca luz ou em aparelhos com 3+ câmeras.
- **Sugestão:** `start({ facingMode: { ideal: 'environment' } })` como padrão, mantendo o seletor de câmera como alternativa. `qrbox` em função do visor. Botão de lanterna quando suportado. Modo "leitura contínua" na venda e na compra, com intervalo anti-duplicata e vibração. Opcionalmente, usar a `BarcodeDetector` nativa (Android/Chrome) quando disponível, que é mais rápida.

### M7. Alturas em `100vh` no iOS: rodapé atrás da barra do Safari
- **Onde:** `src/shared/layouts/DashboardLayout.tsx:13` (`h-screen`), `src/components/Sidebar.tsx:52` (`h-screen`) e `src/shared/components/Modal/Modal.tsx:77` (`max-h-[90vh]`).
- **Problema:** no Safari do iOS, `100vh` inclui a área atrás da barra de endereço e da barra inferior. Com o shell em `overflow-hidden`, a paginação e os botões do rodapé ficam escondidos. Nos modais, os botões de salvar ficam sob o teclado.
- **Sugestão:** `h-dvh` / `max-h-[90dvh]` (o Tailwind 3.4 já suporta), com fallback `h-screen`.

### M8. Alvos de toque pequenos
- **Onde:**
  - Ícones de editar e excluir com 18px e sem padding: `src/modules/products/hooks/useProductColumns.tsx:79-95`, `src/modules/products/components/ProductVariantColumns.tsx:67-86`, `src/shared/components/NamedEntityPage.tsx:84-99`. O mesmo em `src/shared/components/crud/CrudActions.tsx:24-30`, que hoje não é usado.
  - Paginação com `py-1` (cerca de 30px): `src/shared/components/crud/CrudPagination.tsx:36-62`.
  - Limpar e abrir do autocomplete com `p-1` (cerca de 26px): `src/shared/components/form/Autocomplete.tsx:186`, `:205`.
  - "Estornar" com `py-1`: `src/modules/finance/pages/FinanceDetailPage.tsx:138`.
  - "Cancelar leitura" como texto solto: `src/modules/sales/components/SaleBarcodeInput.tsx:95`, `src/modules/inventory/components/InitialInventoryScanner.tsx:31`.
  - Radios e checkbox nativos (cerca de 13px): `src/modules/sales/pages/SaleCreatePage.tsx:368-375`, `src/modules/finance/pages/FinanceListPage.tsx:181-183`.
- **Problema:** com alvos de 18 a 30px ficam bem abaixo dos 44px recomendados. Excluir fica a 12px de editar, o que favorece toques errados, mesmo com a confirmação.
- **Sugestão:** `min-h-11 min-w-11` (44px) com `p-2.5` nos botões de ícone. Radios e checkboxes como linhas inteiras clicáveis com `h-5 w-5`.

### M9. Download de etiquetas (PDF) e CSV no iPhone/iPad
- **Onde:** `src/modules/inventory/hooks/useGenerateInventoryProductLabels.ts:25-38` (link `download` criado depois de um `await`, sem ser anexado ao DOM, com o blob revogado em 1s) e `src/shared/utils/download.ts:49-58` (CSV). O fluxo reinicia logo após o "download" (`src/modules/inventory/hooks/useInitialInventoryFlow.ts:404-410`).
- **Problema:** o iOS Safari 13+ aceita `download` com blob, mas mostra uma folha de confirmação e salva em Arquivos > Downloads. O usuário precisa ir até lá para abrir e imprimir a etiqueta. O wizard já avançou e não há botão "abrir de novo". Revogar a URL em 1s pode cancelar o download em alguns iOS (verificar no aparelho). Em PWA instalado no iOS (modo standalone), download de blob não funciona. O próprio código já admite que não detecta bloqueio silencioso.
- **Impacto:** o estoquista no iPhone gera etiquetas e "não acontece nada" visível.
- **Sugestão:** depois de gerar, mostrar uma tela com "Baixar/Imprimir PDF" (clique direto do usuário), "Compartilhar" via `navigator.share({ files: [new File([blob], nome, { type: 'application/pdf' })] })` quando `navigator.canShare` permitir (abre AirPrint ou apps de impressora Bluetooth) e "Gerar de novo". Aumentar a revogação para cerca de 60s e anexar o link ao DOM.

### M10. Lista do autocomplete escondida pelo teclado ou cortada
- **Onde:** `src/shared/components/form/Autocomplete.tsx:212` (`absolute max-h-64`, abre sempre para baixo), dentro de modais com rolagem (`src/shared/components/Modal/Modal.tsx:104`) e de Sections com `overflow-hidden`.
- **Problema:** no celular, com o teclado aberto, a lista de 256px abaixo do campo fica atrás do teclado, e a seleção é por toque. A seleção em si funciona por toque (`onMouseDown` preventDefault + `onClick`, `:229-232`), mas não há `scrollIntoView` do campo ao abrir.
- **Sugestão:** ao focar no celular, rolar o campo para o topo (`scrollIntoView({ block: 'start' })`). No celular, mostrar o autocomplete como folha em tela cheia (campo no topo e lista abaixo).

### M11. Foco automático abre o teclado sem o usuário pedir
- **Onde:** `src/modules/sales/components/SaleBarcodeInput.tsx:53` (`autoFocus`, também usado na compra) e `src/shared/components/Modal/Modal.tsx:44-50` (foca o primeiro campo do corpo ao abrir).
- **Problema:** no celular, o teclado sobe ao abrir "Nova venda" ou qualquer modal e cobre metade da tela. Na venda, o primeiro passo é escolher o cliente, não o código. No desktop o autoFocus ajuda (leitor USB); no celular atrapalha.
- **Sugestão:** aplicar o autoFocus só com `matchMedia('(pointer: fine)')`. Nos modais em touch, focar o container (o `tabIndex=-1` já existe) em vez do input.

### M12. Etiqueta de caixa não pode ser lida pela câmera
- **Onde:** `src/modules/inventory/components/InitialInventoryBoxStep.tsx:80-89` (busca de caixa só digitando "B000001").
- **Problema:** o sistema gera etiquetas para as caixas, mas na hora de guardar o estoquista tem que digitar o código da caixa no celular.
- **Sugestão:** botão "Escanear caixa" reutilizando o `BarcodeScanner`, com o mesmo formato Code128 da etiqueta.

---

## BAIXO: acabamento

### B1. `lang="en"` e título "frontend"
- **Onde:** `index.html:2` e `index.html:6`.
- **Problema:** o Chrome no Android oferece "Traduzir esta página?" o tempo todo. O leitor de tela lê com pronúncia inglesa. Não há `theme-color` nem `viewport-fit=cover`, que serve para os recortes de tela do iPhone.
- **Sugestão:** `lang="pt-BR"`, um título real, `<meta name="theme-color">`.

### B2. ConfirmDialog sem margem lateral e sem altura máxima
- **Onde:** `src/shared/components/ConfirmDialog.tsx:46` (overlay sem `p-4`) e `:57` (`max-w-md` sem `max-h`/rolagem).
- **Problema:** no celular o cartão encosta nas bordas, e com descrições longas não rola.
- **Sugestão:** `p-4` no overlay, `max-h-[90dvh] overflow-y-auto`, e botões `flex-col-reverse sm:flex-row` com largura total no celular. Opcionalmente, mostrar os modais como folha inferior (bottom sheet) abaixo de `sm`.

### B3. Trava de rolagem no lugar errado
- **Onde:** `src/shared/components/Modal/useDialogBehavior.ts:72-73`.
- **Problema:** o bloqueio vai no `body`, mas quem rola é o `<main>` (`src/shared/layouts/DashboardLayout.tsx:24`). No iOS, o fundo rola atrás do modal ao arrastar.
- **Sugestão:** travar o elemento que rola, ou usar `overscroll-behavior: contain` no corpo do modal.

### B4. Gráfico do dashboard: valores só no hover
- **Onde:** `src/modules/dashboard/components/SalesChart.tsx:30` (`title=` mostra o valor só ao passar o mouse).
- **Problema:** as barras em `flex-1` se adaptam bem à largura (OK), mas no toque não há como ver o valor do dia. A tabela `sr-only` (`:41-58`) só serve a leitores de tela.
- **Sugestão:** tocar na barra mostra o valor (estado selecionado), ou mostrar o valor acima de cada barra em telas `≥ sm`. O resto do dashboard já colapsa bem (`src/modules/dashboard/pages/DashboardPage.tsx:59`, `:106`, `:110`, `:114`).

### B5. Interações por hover
- **Situação:** nenhuma função crítica depende só de hover (bom). Os únicos pontos são os `title=` do gráfico (B4) e `onMouseEnter` no autocomplete (`src/shared/components/form/Autocomplete.tsx:229`, inofensivo). Estilos `hover:` podem ficar "grudados" após o toque no iOS.
- **Sugestão:** opcionalmente, ativar `future: { hoverOnlyWhenSupported: true }` no Tailwind.

### B6. PWA inexistente
- **Situação:** não há `manifest.webmanifest`, ícones PNG ou `apple-touch-icon`, nem service worker. `public/` só tem `favicon.svg` e `icons.svg`.
- **Problema:** não é instalável na tela inicial e não tem nada offline.
- **Sugestão:** adicionar `vite-plugin-pwa` com manifest, ícones e cache do shell (os chunks já estão separados). Lembrar que o PWA no iOS piora downloads (M9). Funcionamento offline com fila de leituras é outro projeto, maior.

### B7. Código morto e utilitários enganosos
- **Onde:** `src/App.css` (184 linhas com `@media`, nunca importado) e `src/shared/hooks/useIsMobile.ts:1-3` (não reativo e não usado).
- **Sugestão:** remover. Se for preciso, criar um `useMediaQuery` com `matchMedia` e listener.

### B8. Toasts no canto superior direito com `expand`
- **Onde:** `src/main.tsx` (`<Toaster position="top-right" ... expand />`).
- **Problema:** no celular, vários toasts expandidos cobrem o cabeçalho e o botão voltar.
- **Sugestão:** `position="top-center"` no celular e sem `expand`.

---

## Pontos positivos (não mexer)

- A tela de **Nova venda** e a de **Novo pedido de compra** já têm container `max-w-*` com `px-4 sm:px-6`, formulário `flex-col sm:flex-row` e botões `flex-col-reverse sm:flex-row` (`src/modules/sales/pages/SaleCreatePage.tsx:201`, `:424`; `src/modules/sales/components/SaleBarcodeInput.tsx:48`). Falta só o carrinho (M4).
- O **wizard do inventário inicial** é em coluna única, com inputs `p-3` e botões `py-3` (cerca de 48px), `inputMode="numeric"` nas quantidades (`src/modules/inventory/components/InitialInventoryBoxStep.tsx:142-143`, `src/modules/inventory/components/InitialInventoryLabelQuantity.tsx:37`) e escolhas em botões grandes. Não usa o `Page` de altura fixa, então rola normalmente.
- O **Modal** genérico tem `p-4`, `max-h` e corpo com rolagem (`src/shared/components/Modal/Modal.tsx:68`, `:77`, `:104`). Os formulários em modal usam `sm:` corretamente (por exemplo, `src/modules/purchases/components/ReceivePurchaseModal.tsx:104`).
- **Filtros** de compras e financeiro usam `grid sm:grid-cols-2 lg:grid-cols-4/5`. Os detalhes de venda, compra e financeiro usam `flex-wrap` e `overflow-x-auto` nas tabelas.
- O **html5-qrcode** é carregado só ao abrir o scanner (`src/components/BarcodeScanner.tsx:5`), o que é bom para 3G/4G no armazém.
- Formulários de cliente, fornecedor e usuário usam `type="email"`/`type="tel"` e `autoComplete` corretos.

---

## Contagem

- **Alto:** 8 (A1–A8)
- **Médio:** 12 (M1–M12)
- **Baixo:** 8 (B1–B8)

## Veredito

Hoje o sistema **não é utilizável em celular** e é **sofrível em tablet retrato**. O menu fixo de 256px deixa menos de 100px para o conteúdo num telefone. O layout de altura fixa esconde listas e paginação quando os filtros empilham. Cabeçalhos e paginação cortam botões. E a câmera, que é o caso de uso central do armazém, não abre fora de HTTPS, sem nenhuma mensagem que explique isso. Em **tablet paisagem (1024px)** funciona razoavelmente, exceto pelo menu que não rola e pelo modo escuro. A boa notícia: as telas mais novas (venda, compra, wizard de inventário, modais, filtros) já foram escritas com classes responsivas. O problema está concentrado em poucos componentes compartilhados (`DashboardLayout`, `Sidebar`, `Page`, `Section`, `CrudPagination`, `DataTable`, `BarcodeScanner`), então a correção rende muito por linha alterada.

## Abordagem recomendada (ordem e tamanho aproximado)

| # | Entrega | Resolve | Tamanho |
|---|---|---|---|
| 1 | **Shell responsivo:** barra superior com hambúrguer e menu em gaveta abaixo de `lg`; nav com rolagem; `h-dvh`; padding do main responsivo; `lang="pt-BR"` e título | A1, A2, M7, B1 | ~1 dia |
| 2 | **Página que rola no celular:** `Page`/`Section` com altura fixa e `overflow-hidden` só em `lg:`; `flex-wrap` em cabeçalhos e paginação; filtros recolhíveis no celular | A3, A4 | ~1 dia |
| 3 | **Correções rápidas de CSS:** remover o dark mode quebrado e definir tokens; inputs com 16px no celular; `DetailsGrid`/`ProductForm` responsivos; `overflow-x-auto` nos lotes; `ConfirmDialog` com margem | A7, A8, M2, M3, B2 | ~0,5 dia |
| 4 | **Scanner para armazém:** checagem de HTTPS e permissão com mensagens claras e "tentar de novo"; `facingMode: environment`; qrbox proporcional; lanterna; leitura contínua com vibração; campo editável no inventário inicial; escanear caixa; HTTPS no dev (basic-ssl e proxy `/api`) e nota de deploy | A5, A6, M6, M12 | ~1,5–2 dias |
| 5 | **Tabela → cartões:** prop `mobile` nas colunas do `DataTable` e renderização em cartões abaixo de `md`, aplicada às ~12 listas; ações com 44px num menu "⋯" | M1, M8 (parte) | ~1,5–2 dias |
| 6 | **Formulários mobile-first:** `MoneyInput`/`QuantityInput` (text com inputMode e parse com vírgula, stepper ±); carrinho de venda e itens de compra como cartões no celular; autocomplete em tela cheia no celular; autoFocus só com ponteiro fino | M4, M5, M10, M11 | ~1,5 dia |
| 7 | **Entrega de PDF/CSV no iOS:** tela "Etiquetas prontas" com Baixar, Compartilhar (Web Share com arquivo) e Gerar de novo | M9 | ~0,5 dia |
| 8 | **Opcional:** manifest e PWA instalável; toasts no topo central; valores do gráfico ao toque; limpeza de código morto | B3–B8 | ~0,5–1 dia |

**Total estimado:** cerca de 7 a 9 dias de desenvolvimento para deixar celular e tablet em bom nível, mais cerca de 1 dia de teste em aparelhos reais (pelo menos um iPhone com Safari, um Android com Chrome e um iPad ou tablet Android nas duas orientações). Sugestão de corte: os itens 1–4 (cerca de 4 dias) já destravam o uso em celular no armazém e em tablet para vendas. Os itens 5–7 tiram o "sofrido".
