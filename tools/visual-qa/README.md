# QA visual (headless)

Captura as telas do frontend em várias larguras e nos dois temas, sem backend nem banco: o `server.mjs` serve o build e uma API de mentira montada a partir de `frontend/src/test/fixtures/**`.

Requisitos: Node 22 (WebSocket nativo) e Chrome/Chromium (`/usr/bin/google-chrome` por padrão; mude com `--chrome` ou `QA_CHROME`). Nenhuma dependência npm além das do frontend.

## Portas
Padrões fora de 5173/3000 para não esbarrar nos servidores de dev: **4400** (build + mock) e **4401** (depuração do Chrome). Troque com `--port`, `--cdp-port` ou `QA_PORT`, `QA_CDP_PORT`. Se o servidor estiver em outro endereço, use `--base http://host:porta`.

## Passo a passo
```bash
# 1. Build para uma pasta temporária (não suja frontend/dist)
cd frontend && npx vite build --outDir "$TMPDIR/qa-dist" --emptyOutDir

# 2. Servidor mock + build (deixe rodando em outro terminal ou em segundo plano)
node tools/visual-qa/server.mjs "$TMPDIR/qa-dist" --port 4400

# 3. Capturas: todas as páginas, larguras 375/768/1280/1440/1920, temas claro e escuro
node tools/visual-qa/run.mjs --out "$TMPDIR/qa-shots"
#    só alguns casos:
node tools/visual-qa/run.mjs --out "$TMPDIR/qa-shots" --widths 375,1440 --themes dark --only dashboard,sales

# 4. Modais e fluxos curtos (criar marca, cancelar venda, pagamento...)
node tools/visual-qa/interact.mjs --out "$TMPDIR/qa-shots" --widths 375,1440

# 5. Contraste WCAG (1440 px, os dois temas; use --widths para outras)
node tools/visual-qa/contrast.mjs --out "$TMPDIR/qa-contrast.json"
```
(`$TMPDIR` pode ser qualquer pasta; sem `--out`, os scripts gravam em `os.tmpdir()`.)

## O que cada script faz
- `server.mjs <dist>`: serve o build (fallback SPA) e `/api/*` com as fixtures. `/users/me` devolve ADMIN, listas são repetidas até parecerem reais (3 páginas), escritas respondem `{ data: {} }`. Opção `--fixtures <pasta>`.
- `run.mjs`: abre cada rota de `pages.mjs` por largura e tema, grava `<pagina>-<largura>-<tema>.png` (e `-full.png` quando há rolagem interna) e **falha (exit 1) se houver rolagem horizontal** em `main`.
- `interact.mjs`: igual, para modais e fluxos (lista no topo do arquivo).
- `contrast.mjs`: percorre as rotas, calcula a razão de contraste de todo texto visível (cor efetiva sobre o fundo composto) e **falha (exit 1)** abaixo de 4,5 (texto normal) ou 3 (texto grande). Texto desabilitado é isento. O relatório JSON lista todas as combinações, da pior para a melhor.
- `cdp.mjs`, `config.mjs`, `pages.mjs`: biblioteca comum (Chrome por CDP, argumentos, rotas).

## Como o tema e a sessão são definidos
`localStorage['ui.theme']` (`light` | `dark` | `system`) e `localStorage.token = 'fake'` (o mock aceita qualquer token). A página `login` roda sem token.

## Ao mudar telas
Rotas novas entram em `pages.mjs` (use ids das fixtures); rotas de API novas, em `route()` de `server.mjs`. Confira sempre 375 e 1440 px nos dois temas e contraste sem falhas antes de dar a tela como pronta.
