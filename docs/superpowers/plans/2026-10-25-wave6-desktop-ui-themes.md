# Onda 6 — Telas no desktop, cores e temas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir posicionamento e cores no desktop e entregar temas Claro/Escuro/Seguir o sistema, com todas as telas usando tokens.

**Architecture:** Tokens como variáveis CSS (canais RGB) + extensão do Tailwind; store de tema com script anti-flash; componentes compartilhados com variantes e mapa de status; telas migradas para tokens; regra de lint contra cor crua.

**Tech Stack:** React 19, Tailwind 3, zustand, Vite, Vitest + MSW; headless Chrome para capturas.

**Spec:** `docs/superpowers/specs/2026-10-25-wave6-desktop-ui-themes-design.md` (detalhes em `docs/reviews/2026-10-25-auditoria-desktop-ui.md`)

## Global Constraints

- Branch `feat/wave6-ui-themes`; `git add` com caminhos explícitos. Frontend apenas.
- Nenhuma dependência nova (usar `clsx`/`tailwind-merge` só se já estiverem no `package.json`).
- Tokens com os nomes e valores da tabela "Conjunto de tokens proposto" da auditoria.
- Mobile (onda 4) não regride; testes existentes continuam passando (ajustar só seletores/classes, não comportamento).
- Capturas antes/depois com `scratchpad/tools` da auditoria em 1280, 1440, 1920 e 375, temas claro e escuro.
- CI verde: lint 0, typecheck 0, testes, build.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Nenhum texto invisível ou com contraste < 4,5:1 em nenhuma tela, nos dois temas — Tasks 1–4.
2. Recarregar a página com tema Escuro não pisca o claro; `localStorage` bloqueado não quebra a página — Task 2.
3. Modais/gaveta em portal continuam com foco preso, Escape e trava de rolagem (onda 2/4) — Task 1.
4. Em 1280×800 nada fica escondido (variantes do produto, tabelas, paginação) e a página rola — Task 3.
5. Status iguais têm a mesma cor em todos os módulos — Task 2.

---

### Task 1: Correções imediatas (spec §1)
- [ ] Testes (falhando): modal em portal fora do menu; `Button` com `cn()`/variantes; dashboard sem overflow (teste de classes/estrutura). Implementar; capturas antes/depois do dashboard, modal "Alterar senha", cliente.
- [ ] Commit — `fix(frontend): portal modals, button variants, remove template CSS and fix dashboard cards`

### Task 2: Tokens, temas e componentes compartilhados (spec §2–3)
- [ ] Testes (falhando): store de tema (aplica, persiste, system, storage bloqueado), função anti-flash, seletor no menu, `statusTone`, badges sem quebra, números à direita, `DetailTable` com padding.
- [ ] Implementar fundação + componentes compartilhados.
- [ ] Commit — `feat(frontend): design tokens with light/dark/system themes and themed shared components`

### Task 3: Layout no desktop (spec §4)
- [ ] Testes (falhando): página rola no desktop; largura máxima; cabeçalho padrão com Voltar. Capturas 1280/1440/1920/375.
- [ ] Commit — `feat(frontend): desktop layout with page scroll, max widths and consistent page headers`

### Task 4: Migração das telas e regra de cor crua (spec §5–6)
- [ ] Migrar módulos para tokens; script de lint que falha com cor crua; pequenos ajustes; capturas finais nos dois temas; contraste medido.
- [ ] Commit — `feat(frontend): migrate screens to theme tokens and forbid raw colors`
