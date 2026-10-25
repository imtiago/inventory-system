# Onda 4 — Celular e tablet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o frontend utilizável em celular e tablet (menu em gaveta, páginas que rolam, listas em cartões, formulários para toque, leitor de código de barras para o depósito) sem regressão no desktop.

**Architecture:** Mudanças concentradas nos componentes compartilhados (`DashboardLayout`, `Sidebar`, `Page`, `Section`, `CrudPagination`, `DataTable`, `BarcodeScanner`, `Modal`, inputs) com breakpoints do Tailwind; telas só passam metadados (`mobile` nas colunas) ou trocam inputs.

**Tech Stack:** React 19, Tailwind 3, Vite, html5-qrcode, Vitest + MSW (jsdom, `matchMedia` simulado).

**Spec:** `docs/superpowers/specs/2026-10-25-wave4-mobile-design.md` (detalhes e `arquivo:linha` em `docs/reviews/2026-10-25-auditoria-mobile.md`)

## Global Constraints

- Branch `feat/wave4-mobile`; `git add` com caminhos explícitos. Frontend apenas (backend intocado).
- Dependência nova permitida só: `@vitejs/plugin-basic-ssl` (devDependency, só no dev server). Nenhuma outra.
- Textos em PT, exatamente como na spec quando ela os fixa.
- Desktop (≥ 1024 px) mantém o comportamento atual; testes existentes continuam passando (ajustar só seletores quando a marcação mudar, nunca a expectativa de comportamento).
- Um helper único para breakpoints em testes (`matchMedia` simulado) em `frontend/src/test/`.
- CI verde: lint 0, typecheck 0, testes, build.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Abaixo de `lg` a página inteira rola e nada fica inacessível (paginação, botões de ação, "Sair") — Task 1.
2. Em `lg+` o layout é idêntico ao atual (menu fixo, rolagem interna da tabela) — Task 1 e 3.
3. Sem HTTPS o usuário consegue continuar digitando o código; a mensagem explica o motivo — Task 2.
4. Cartões mostram as mesmas ações (com as mesmas permissões) que a linha da tabela — Task 3.
5. Valor "12,50" digitado no celular chega ao backend como 1250 centavos em todos os formulários de dinheiro — Task 4.

---

### Task 1: Estrutura e ajustes visuais (spec §1–2)
- [ ] Helper `matchMedia` de teste; testes (falhando): gaveta abre/fecha (botão, Escape, toque fora, navegação) e foco preso; menu fixo em `lg+`; paginação compacta abaixo de `sm`; filtros recolhíveis abaixo de `md` com contador; `index.html` lang/título.
- [ ] Implementar §1–2; suítes 2×, lint, typecheck, build.
- [ ] Commit — `feat(frontend): responsive shell with drawer menu, scrolling pages and mobile visual fixes`

### Task 2: Leitor para o depósito (spec §3)
- [ ] Testes (falhando): sem contexto seguro → mensagem da spec e campo digitável; permissão negada → mensagem + "Tentar de novo"; sem câmera; `facingMode: environment` no start; leitura contínua ignora repetição em 1,5 s; inventário inicial aceita digitação + Enter; "Escanear caixa".
- [ ] Implementar; dev HTTPS + proxy `/api`; README.
- [ ] Commit — `feat(frontend): warehouse-ready barcode scanning (secure context, rear camera, torch, continuous scan, typed input)`

### Task 3: Listas em cartões (spec §4)
- [ ] Testes (falhando): `DataTable` renderiza cartões abaixo de `md` (título/subtítulo/meta, colunas `hidden` omitidas, cartão clicável, menu "⋯" com as ações) e tabela acima; uma lista real (ex.: vendas) com ações e permissões iguais nos dois modos.
- [ ] `mobile` em todas as colunas das listas da spec; lotes do estoque; botões de ícone 44 px.
- [ ] Commit — `feat(frontend): card layout for lists on small screens`

### Task 4: Formulários para toque, etiquetas no iOS, instalável (spec §5–7)
- [ ] Testes (falhando): `MoneyInput` "12,50" → 1250 e envio correto em venda/compra/pagamento/lote/variante; `QuantityInput` ±; itens de venda/compra em cartões abaixo de `md`; autoFocus só com ponteiro fino; painel "Etiquetas prontas" não avança sozinho e oferece Compartilhar quando suportado; manifest servido.
- [ ] Implementar; suítes 2×, build.
- [ ] Commit — `feat(frontend): touch-friendly money and quantity inputs, item cards, iOS-friendly label delivery and installable app`
