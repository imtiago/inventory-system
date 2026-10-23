# Fase 7 — Idempotência das operações que mexem em dinheiro e estoque

**Data:** 2026-10-23
**Status:** decidido (usuário delegou: "faça o que precisar ser feito")

## Problema
Clique duplo, reenvio do navegador ou nova tentativa após timeout de rede podem repetir um POST que já foi concluído no servidor: pagamento registrado duas vezes, venda ou pedido duplicado, entrada de estoque em dobro. Os botões ficam desabilitados durante o envio, mas isso não cobre timeout/reenvio.

## Decisão
Cabeçalho `Idempotency-Key` (padrão de mercado, ex.: Stripe) nas rotas críticas, com o registro da chave **na mesma transação** da operação:

1. Rotas cobertas (o cabeçalho é **obrigatório** nelas → sem ele 400 `IDEMPOTENCY_KEY_REQUIRED` "Cabeçalho Idempotency-Key é obrigatório."):
   - `POST /sales`, `POST /sales/:id/cancel`
   - `POST /receivables/:id/parcels/:parcelId/payments`, `POST /receivables/payments/:paymentId/reverse`
   - `POST /payables/:id/parcels/:parcelId/payments`, `POST /payables/payments/:paymentId/reverse`
   - `POST /purchases`, `POST /purchases/:id/receipts`, `POST /purchases/:id/cancel`
   - `POST /nfe-imports/:id/confirm`
   - `POST /inventory/receive`, `POST /inventory/dispatch`, `POST /inventory/adjust` (e demais POST de movimentação de estoque em `inventoryRoutes` que alteram saldo)
2. Chave: 8–100 caracteres `[A-Za-z0-9_-]` (o front usa UUID v4); escopo = usuário + método + rota (padrão da rota, ex. `POST /sales/:id/cancel`) + chave.
3. **Na mesma transação** (o `TransactionManager` com AsyncLocalStorage faz os casos de uso aninhados entrarem na transação externa):
   - insere `IdempotencyRecord (userId, method, route, key, requestHash, createdAt)` com `ON CONFLICT DO NOTHING`;
   - se já existia: lê com `FOR UPDATE` (espera a transação concorrente terminar) →
     - mesmo `requestHash` e resposta gravada → devolve a resposta gravada (mesmo status e corpo) com cabeçalho `Idempotent-Replayed: true`, sem executar nada;
     - `requestHash` diferente → 422 `IDEMPOTENCY_KEY_REUSED` ("Esta chave já foi usada em outra operação.");
   - senão executa a operação, grava `statusCode` e `responseBody` no registro e confirma junto.
   - Se a operação falhar (qualquer erro), a transação é desfeita **inclusive o registro** → a nova tentativa executa de novo (erros de validação/regra não ficam "presos" na chave).
   - Duas requisições simultâneas com a mesma chave: a segunda espera a primeira no índice único; se a primeira confirmou, replay; se falhou, a segunda executa.
4. `requestHash` = SHA-256 de `method + route + params + JSON canônico do corpo` (chaves ordenadas).
5. Retenção: registros com mais de 24 h são removidos de forma preguiçosa (a cada N inserções ou por `DELETE ... WHERE createdAt < now() - interval '24 hours'` no mesmo fluxo, limitado) e há um script `npm run purge-idempotency`.
6. Replay só para o mesmo usuário (outro usuário com a mesma chave → escopo diferente, executa normalmente).

## Frontend
- Utilitário `newIdempotencyKey()` (UUID v4 via `crypto.randomUUID`).
- Cada ação coberta gera a chave quando o usuário dispara o envio e **reusa a mesma chave** em reenvios da mesma tentativa (ex.: erro de rede/timeout seguido de "Tentar novamente"); gera chave nova quando os dados mudam ou depois de sucesso. Implementar no nível do hook de mutação (`useCrudMutation` ganha suporte a `idempotent: true`) para não espalhar a lógica.
- Nenhuma mudança visível ao usuário; replay é tratado como sucesso normal.

## Testes e aceite
Backend: sem cabeçalho → 400 em cada rota coberta (teste por tabela); mesma chave e mesmo corpo → uma única venda/pagamento/recebimento/movimentação e mesma resposta com `Idempotent-Replayed`; mesma chave com corpo diferente → 422; duas requisições simultâneas com a mesma chave → um único efeito e duas respostas iguais; operação que falha não grava a chave (nova tentativa com a mesma chave executa); chave de outro usuário não faz replay; purge remove registros antigos.
Frontend: cada mutação coberta envia `Idempotency-Key`; reenvio após erro de rede usa a mesma chave; após sucesso a próxima ação usa chave nova.
Aceite: CI verde; backend `npm test` 3× local.
