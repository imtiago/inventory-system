# Onda 6 — Telas no desktop, cores e temas

**Data:** 2026-10-25
**Status:** decidido. O usuário pediu: corrigir o posicionamento das telas no desktop, melhorar a cor das letras e, no final, implementar temas ("faça isso tudo").

**Fonte:** `docs/reviews/2026-10-25-auditoria-desktop-ui.md`, com os achados A1–A9, M1–M16 e B1–B11 em `arquivo:linha`, a tabela de contrastes, os tokens propostos e a ordem de trabalho. Esta spec adota a auditoria como requisito.

**Temas:** Claro, Escuro e Seguir o sistema. O padrão é Seguir o sistema.

## 1. Correções imediatas (A1, A2, A5, A8, A9, B1, B2, B11)
- O `Modal` (e a gaveta) é renderizado em portal no `document.body`. Assim não herda cor nem estilo de quem o abriu.
- `Button` junta classes com `cn()` (tailwind-merge, se já existir; senão o util existente) e tem variantes `primary | secondary | outline | ghost | danger`.
- Sai todo o CSS do template Vite de `index.css` e `App.css`:
  - cor padrão `#6b6375`;
  - estilos globais de `h1`/`h2`;
  - raiz de 18 px.
- Tipografia base:
  - 16 px no corpo, `text` (token) como cor padrão;
  - escala de títulos: página 24/600, seção 18/600, cartão 16/600;
  - números tabulares em valores e tabelas.
- Dashboard: grade de KPIs que não transborda em 1280/1440/1920, valores em `text` com `font-semibold`.

## 2. Tokens e temas (seção "Temas" da auditoria)
- Variáveis CSS em canais RGB: `:root` com o tema claro, `:root[data-theme="dark"]` com o escuro, e `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`.
- Tokens da tabela da auditoria, com os nomes dela:
  - fundos: `background`, `surface`, `surface-muted`;
  - bordas e campos: `border`, `input`;
  - texto: `text`/`foreground`, `text-muted`, `text-subtle`;
  - ação principal: `primary`, `primary-foreground`, `primary-hover`;
  - estados, cada um com a versão `-soft`: `success`, `warning`, `danger`, `info`; mais `danger-solid` e `danger-foreground`;
  - foco: `ring`;
  - menu: `sidebar*`;
  - `overlay`;
  - gráficos: `chart-1…6`.
- Em `tailwind.config.ts`: `darkMode: ['class', '[data-theme="dark"]']` e as cores no formato `rgb(var(--x) / <alpha-value>)`. Passam a existir também os tokens já usados pelo código: `muted-foreground`, `card`, `destructive` etc., como aliases dos novos.
- Preferência em `localStorage['ui.theme']` (`light | dark | system`), lida por um store `useThemeStore`.
  - Aplica `data-theme` e `color-scheme`.
  - Atualiza `<meta name="theme-color">`.
  - Em `system`, acompanha a mudança do sistema operacional.
- Script inline no `<head>` define o tema antes da primeira pintura, para não piscar o tema errado. Fica dentro de try/catch e funciona com o `localStorage` bloqueado.
- Seletor "Tema" no rodapé do menu, junto de "Alterar senha", com Claro, Escuro e Seguir o sistema (ícones Sun, Moon e Monitor). Também fica acessível na gaveta do celular.

## 3. Componentes compartilhados (A3, A6, A7, M3, M4, M9, M11, M14)
- Componentes: `Badge`/`CrudBadge`, `Button`, `DetailTable`, `DataTable`, `CrudPagination`, `Section`, `PageHeader`/`CrudHeader`, `Modal`, `Sidebar`, `form/*`.
- Todos passam a usar só tokens.
- Status com cor de significado, num mapa único `statusTone`:
  - concluída/paga/recebida/disponível → `success`;
  - aberta/a vencer/parcial/reservado → `info` ou `warning`;
  - cancelada/vencida/sem estoque/erro → `danger`.
  - O mapa vale para vendas, compras, contas, estoque, NF-e e usuários.
- Badges não quebram linha.
- Números alinhados à direita nas tabelas.
- `DetailTable` com espaçamento lateral.

## 4. Layout no desktop (A4, M1, M2, M5, M6, M7, M8, M10, M12, M16)
- A página rola no desktop também: some a altura fixa de `Page`/`Section`. O cabeçalho da tabela pode ficar fixo (sticky) dentro da página.
- Largura máxima do conteúdo para telas largas: listas até cerca de 1440 px e formulários/detalhes até cerca de 1100 px, centralizados.
- Cabeçalhos de página padronizados:
  - título, descrição e ações à direita;
  - botão "Voltar" no mesmo lugar em todas as telas de detalhe.
- Detalhes em cartões consistentes (venda, pedido, contas, estoque).
- Filtros com larguras e espaçamento padronizados.
- Menu com rolagem visível.
- Mobile não pode regredir: o que a onda 4 entregou continua valendo.

## 5. Migração das telas (Temas, passo 8)
- As cerca de 916 classes de cor crua nos módulos passam para tokens.
- Regra no CI que falha se aparecer cor crua em `.tsx` fora de testes e de uma lista de exceções justificada. A regra é um script de grep no lint, sem dependência nova.

## 6. Pequenos ajustes (M13, M15, B3–B10)
Conforme a auditoria.

## Testes e aceite
- **Testes de comportamento:**
  - modal em portal mantém a cor e o foco;
  - `Button` aceita `className` que sobrescreve sem perder a variante;
  - mapa `statusTone` por status;
  - store de tema: aplica `data-theme`, persiste, `system` acompanha `matchMedia`, sobrevive a `localStorage` bloqueado;
  - script anti-flash: teste unitário da função que ele executa;
  - seletor de tema no menu;
  - a página rola no desktop.
- **Revisão visual automatizada:** capturas com as ferramentas da auditoria (`scratchpad/tools`), nas larguras 1280, 1440, 1920 e 375, nos temas claro e escuro.
- **Contraste medido:** nenhum par texto/fundo abaixo de 4,5:1, ou 3:1 para texto grande.
- **Aceite:** CI verde (lint, incluindo a regra de cor crua; typecheck; testes; build), mais o check visual.
