# Onda 3 — Desempenho e produção (revisão geral 2026-10-25)

**Data:** 2026-10-25
**Status:** decidido (usuário: "pode seguir"). Achados de origem em `docs/reviews/2026-10-25-revisao-geral.md`; inclui os 9 menores adiados da onda 2.

## 1. Execução em produção (Alto: "Não existe build/start de produção nem desligamento gracioso")
- `npm run build` gera `backend/dist/server.js` com os aliases (`@shared/*`, `@finance/*`, …) resolvidos; `npm start` = `node dist/server.js`. Ferramenta: `tsup` (devDependency; bundla só o código do projeto, `node_modules` ficam externos). O `dev` continua com `tsx watch`.
- `PORT` (padrão 3000) e `HOST` (padrão `0.0.0.0`) lidos do ambiente.
- Desligamento gracioso: SIGTERM/SIGINT → `await app.close()` (para de aceitar conexões e espera as requisições em andamento) com limite de 10 s, depois sai; hook `onClose` faz `prisma.$disconnect()`.
- Ambiente validado com Zod na subida (`env.ts`): `DATABASE_URL` URL obrigatória; `JWT_SECRET` obrigatório e, com `NODE_ENV=production`, com ≥ 32 caracteres; `PORT` inteiro 1–65535; `CORS_ORIGINS`, `TRUST_PROXY` opcionais. Erro → mensagem PT listando as variáveis inválidas e processo não sobe. `backend/.env.example` documentado (inclui `openssl rand -base64 48`).
- CI do backend passa a rodar `npm run build` e um smoke: sobe `node dist/server.js` com o banco do CI e espera `GET /health` = 200.

## 2. Proteções HTTP (Médio: "Sem rate limit global, cabeçalhos de segurança, health check ou limites explícitos"; Baixo: CORS; Médio: login atrás de proxy)
- `GET /health` público (incluído nas rotas públicas): `SELECT 1` → `200 { status: "ok" }`; banco fora → `503 { status: "unavailable" }`. Sem dados sensíveis.
- `@fastify/helmet` com os padrões (API JSON; CSP padrão não atrapalha respostas JSON/PDF/CSV).
- `@fastify/rate-limit` global: 300 requisições/min por usuário autenticado (chave `sub` do token já validado) ou por IP sem token; `/reports/*` 20/min; `/health` fora do limite. Resposta 429 no formato de erro do projeto: `{ code: "RATE_LIMITED", message: "Muitas requisições. Aguarde um instante e tente novamente." }` com `Retry-After`. Testes podem desligar/elevar via opção do `buildApp`/ambiente (`RATE_LIMIT_DISABLED=1` só fora de produção).
- CORS: `CORS_ORIGINS` (lista separada por vírgula). Definida → só essas origens. Ausente → fora de produção reflete a origem (como hoje); em produção a subida falha pedindo `CORS_ORIGINS`.
- `TRUST_PROXY`: `true`/número de saltos/lista de IPs → `trustProxy` do Fastify (o limitador de login e o rate limit passam a ver o IP real).
- Limites explícitos: `bodyLimit` 1 MiB (JSON); upload de NF-e mantém o limite próprio do multipart; `connectionTimeout`/`requestTimeout` 60 s.
- Erros: 413 → "Arquivo ou requisição grande demais." (`PAYLOAD_TOO_LARGE`); 415 → "Tipo de conteúdo não suportado." (`UNSUPPORTED_MEDIA_TYPE`); JSON malformado → "JSON inválido." (`INVALID_JSON`); Prisma P2028 (pool esgotado / `maxWait`) → `503 { code: "SERVICE_BUSY", message: "Sistema ocupado. Tente novamente em instantes." }`.

## 3. Índices (Médios: StockMovement, FinancialDocument, catálogo, FKs)
Uma migration nova, SQL escrito à mão (`CREATE INDEX IF NOT EXISTS`), aplicada com `migrate deploy`, `schema.prisma` com os `@@index` correspondentes:
- `StockMovement`: `(origin, originId)`, `(productVariantId, createdAt)`, `(inventoryId, createdAt)`, `(createdAt)`.
- `InventoryLot`: `(inventoryId, remainingQuantity)`.
- `FinancialDocument`: `(type, originType, originId)`, `(type, partyId)`, `(type, status)`.
- `Sale`: `(customerId)`, `(createdAt)`.
- `PurchaseItem`: `(purchaseId)`.
- `ProductVariant`: `(productId)`; `Product`: `(brandId)`, `(categoryId)`.
(Os nomes de coluna exatos vêm do `schema.prisma`; onde uma coluna citada não existir, indexar a equivalente usada nas consultas e registrar.) README: em produção grande, criar os índices antes com `CREATE INDEX CONCURRENTLY` e marcar a migration com `prisma migrate resolve --applied`.

## 4. Contas a receber/pagar no banco (Alto: "Lista e exportação … carregam o histórico inteiro na memória"; Médio: dashboard agrega Payment inteira)
- Lista (`GET /receivables`, `/payables`): status de exibição, restante, próximo vencimento, filtros (`status`, `openOnly`, contraparte, período de vencimento, busca), ordenação, paginação (`LIMIT/OFFSET`), total e resumo (A vencer / Vencido / Recebido-Pago) calculados em SQL — mesma regra de restante que o dashboard (`amount − Σ pagamentos não estornados`), mesma data de negócio (America/Sao_Paulo) para "vencido". Contrato HTTP e resultados idênticos aos atuais (os testes existentes continuam passando sem alteração de expectativa).
- Exportação CSV: o SQL busca no máximo `maxRows + 1` linhas e responde o erro de exportação grande demais sem carregar o resto.
- Dashboard: o bloco financeiro só agrega pagamentos das parcelas de documentos abertos (`OPEN`/`PARTIALLY_PAID`) do tipo pedido, aproveitando `Payment_parcelId_idx` e o índice `(type, status)`; resultado idêntico.
- Teste de equivalência: com uma massa variada (pago, parcial, estornado, cancelado, vencido, a vencer, várias contrapartes) a nova lista/resumo/exportação devolvem o mesmo que a implementação anterior para cada combinação de filtros coberta.

## 5. Frontend leve (Alto: "Bundle único de ~989 kB")
- Rotas com `React.lazy` + `Suspense` (fallback de carregamento discreto dentro do layout, sem piscar o menu); login em chunk próprio pequeno.
- `html5-qrcode` carregado sob demanda (import dinâmico ao abrir o scanner).
- `manualChunks` para vendor (react/react-dom/router, tanstack, demais).
- Aceite: `vite build` sem o aviso de chunk > 500 kB; o chunk de entrada < 250 kB (não gzip); falha ao baixar um chunk (deploy novo) mostra "Nova versão disponível — recarregar" em vez de tela branca.

## 6. Menores adiados da onda 2
- Coluna de estoque não mostra "Sem estoque" enquanto os saldos da nova página carregam (mostra "…"/vazio).
- Segundo envio ignorado não reabilita "Salvar" enquanto o primeiro está pendente.
- 403 em rajada revalida `/users/me` uma vez por rajada (mesma janela da mensagem).
- "Tentar novamente" da tela de erro de sessão mostra estado de carregando e fica desabilitado durante a tentativa.
- Lista de vendas com período inválido não mostra as linhas do período anterior (mostra o aviso do período e nenhuma linha/estado vazio).
- Redirecionamento após confirmar NF-e só acontece se o usuário ainda estiver na tela da importação.
- Etiquetas: download por link (`<a download>`) com fallback; sem detectar bloqueio não há aviso falso — manter, só documentar no código (sem mudança de comportamento).
- Testes que faltaram: parâmetros enviados pela exportação de vendas; confirmação dentro de modal (Escape fecha só a de cima); clique duplo em marca/categoria, fornecedor e usuário.

## Testes e aceite
Cada item com teste que falha antes (comportamento). Aceite: CI verde (backend typecheck, testes no banco de teste, build + smoke `/health`; frontend lint 0, typecheck 0, testes, build sem aviso de tamanho).
