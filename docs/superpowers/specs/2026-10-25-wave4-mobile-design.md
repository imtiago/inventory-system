# Onda 4 — Celular e tablet

**Data:** 2026-10-25
**Status:** decidido (usuário: "pode seguir"; requisito: o sistema deve atender celular e tablet). Achados, com `arquivo:linha`, em `docs/reviews/2026-10-25-auditoria-mobile.md` (A1–A8, M1–M12, B1–B8); os itens abaixo citam esses códigos.

**Alvos:** celular 360–430 px retrato; tablet 768–1024 px nas duas orientações; desktop sem regressão (≥ 1024 px mantém o layout atual: menu fixo, página de altura fixa com rolagem interna da tabela). Breakpoints do Tailwind: `sm` 640, `md` 768, `lg` 1024.

## 1. Estrutura (A1, A2, A3, A4, M7, B1)
- Abaixo de `lg`: menu lateral escondido; barra superior com botão "Abrir menu" (☰, 44 px) e nome da tela; menu como gaveta sobreposta (fundo escurecido, foco preso, Escape e toque fora fecham, fecha ao navegar, trava a rolagem do fundo). Em `lg+`, menu fixo como hoje.
- Navegação do menu rola (`min-h-0 overflow-y-auto`); alturas em `dvh` (com fallback).
- `Page`/`Section`: altura fixa e `overflow-hidden` só em `lg+`; abaixo disso a página rola normalmente. Padding do conteúdo `p-3 sm:p-4 lg:p-6`.
- Cabeçalhos de seção e paginação quebram linha (`flex-wrap`); na paginação abaixo de `sm`, só "Anterior/Próxima" com `aria-label` e a página atual.
- Filtros das listas recolhidos num botão "Filtros" abaixo de `md` (mostrando quantos filtros estão ativos).
- `index.html`: `lang="pt-BR"`, título "Estoque" (ou o nome já usado no login).

## 2. Ajustes visuais (A7, A8, M2, M3, B2, B8)
- Só tema claro: remover `color-scheme: light dark` e o bloco `prefers-color-scheme`; definir `--background`/`--foreground`.
- Inputs, selects e textareas com 16 px abaixo de `sm` (evita o zoom do iOS).
- `DetailsGrid` `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; `ProductForm` `grid-cols-1 sm:grid-cols-2`.
- Tabela de lotes do detalhe do estoque: cartões abaixo de `md` (via §4) ou no mínimo `overflow-x-auto`.
- `ConfirmDialog` com margem lateral e altura máxima com rolagem.
- Toasts no topo central no celular, sem `expand`.

## 3. Leitor de código de barras para o depósito (A5, A6, M6, M12)
- Antes de abrir a câmera: sem contexto seguro (`!window.isSecureContext`) → mensagem "A câmera só funciona em conexão segura (HTTPS). Peça ao administrador para acessar o sistema por https://…" e o campo de digitação continua disponível; permissão negada → mensagem explicando como liberar a câmera no navegador e botão "Tentar de novo"; sem câmera → "Nenhuma câmera encontrada".
- Câmera traseira por padrão (`facingMode: environment`), seletor de câmera como alternativa; área de leitura proporcional à tela; botão de lanterna quando o aparelho suportar.
- Leitura contínua na venda e na compra (cada leitura adiciona o item; mesma leitura ignorada por 1,5 s; vibração curta quando suportada).
- Inventário inicial: campo de código de barras editável (Enter ou "Buscar"), aceita leitores Bluetooth/USB que digitam e dão Enter; botão "Escanear caixa" na etapa da caixa.
- Ambiente de desenvolvimento acessível pelo celular: `vite --host` com HTTPS (`@vitejs/plugin-basic-ssl`, só em dev) e proxy `/api` → backend, para o celular usar a mesma origem; README com o passo a passo (aceitar o certificado no aparelho) e nota de produção (HTTPS obrigatório para a câmera).

## 4. Listas em cartões (M1, M8)
- `DataTable` ganha, por coluna, `mobile?: 'title' | 'subtitle' | 'meta' | 'hidden'`; abaixo de `md` renderiza cartões (cartão inteiro clicável quando a linha leva ao detalhe; ações num menu "⋯" de 44 px). Acima de `md`, a tabela atual.
- Aplicado a todas as listas que usam `DataTable` (produtos, variantes, estoque, vendas, clientes, fornecedores, compras, receber, pagar, NF-e, usuários, marcas, categorias) e à tabela de lotes.
- Botões de ícone com alvo mínimo de 44 px.

## 5. Formulários para toque (M4, M5, M10, M11)
- `MoneyInput` único (`type="text" inputMode="decimal"`, aceita vírgula, mostra "R$") e `QuantityInput` (`inputMode="numeric"`, botões − e + de 44 px), usados em venda, compra, pagamentos, lote, preço de variante, ajuste de estoque.
- Itens da venda e da compra como cartões abaixo de `md` (nome e código; quantidade com − e +; preço e subtotal; remover).
- Autocomplete no celular: ao focar, o campo rola para o topo da área visível; a lista não fica escondida pelo teclado.
- Foco automático só com ponteiro fino (`(pointer: fine)`); em toque, os modais focam o próprio diálogo.

## 6. Etiquetas e CSV no iPhone/iPad (M9)
- Após gerar etiquetas: painel "Etiquetas prontas" com "Baixar PDF" (clique direto do usuário), "Compartilhar" (Web Share com arquivo, quando suportado — abre AirPrint/apps de impressora) e "Gerar de novo"; o fluxo do assistente só segue quando o usuário escolhe. Link anexado ao DOM e URL revogada após 60 s. Mesmo cuidado no download de CSV.

## 7. Instalável (B6, B4)
- Manifest (nome, ícones, `display: standalone`, cor do tema) para "Adicionar à tela inicial"; sem modo offline nesta onda.
- Gráfico do dashboard mostra o valor ao tocar.

## Testes e aceite
- Testes de comportamento (Vitest + jsdom com `matchMedia` simulado): gaveta abre/fecha (botão, Escape, toque fora, navegação); cartões abaixo de `md` e tabela acima; mensagens do scanner sem HTTPS / permissão negada / sem câmera; campo do inventário inicial aceita digitação + Enter; leitura contínua ignora repetição em 1,5 s; `MoneyInput` aceita "12,50"; painel de etiquetas não avança sozinho.
- Verificação visual automatizada em 375×812, 768×1024 e 1280×800 das telas principais, se for possível rodar um navegador headless no ambiente; senão, registrar.
- Aceite: CI verde (frontend lint 0, typecheck 0, testes, build); desktop sem regressão; **teste em aparelho real pelo usuário** (iPhone/Safari, Android/Chrome, tablet nas duas orientações) com HTTPS.
