# Onda 1 — Segurança e integridade (revisão geral 2026-10-25)

**Data:** 2026-10-25
**Status:** decidido (usuário aprovou: "pode seguir"); referências aos achados em `docs/reviews/2026-10-25-revisao-geral.md`

## 1. Sessões derrubadas na troca/redefinição de senha (Alto 4)
- Migration aditiva: `users.passwordChangedAt DateTime?`.
- `ChangeOwnPasswordUseCase`, `ResetUserPasswordUseCase` e `create-admin` (quando redefine a senha) gravam `passwordChangedAt = now()`.
- `authenticate`: token com `iat` (segundos) anterior a `passwordChangedAt` (truncado a segundos) → 401 "Sessão inválida." (`UNAUTHENTICATED`). O leitor de sessão já lê a linha do usuário; incluir a coluna.
- Troca da própria senha devolve um token novo (`200 { data: { token } }` em vez de 204) para o usuário continuar logado na aba atual; o frontend troca o token guardado. Redefinição pelo admin continua 204.

## 2. Entradas/saídas manuais restritas (Alto 5)
- `POST /inventory/receive` e `/inventory/dispatch` (e `/inventory/lots`, `/inventory/initial-count` se aceitarem origem): `origin` só `MANUAL`, `INVENTORY` ou `TRANSFER`; `sourceType` fixo `MANUAL` (o campo deixa de ser aceito do cliente; se vier diferente → 400); `originReferenceId` opcional, uuid; `notes` ≤ 500. SALE/PURCHASE/RETURN/IMPORT ficam exclusivos dos serviços internos.
- `ReturnSaleStockUseCase` não pode responder 500 com dados inconsistentes: se encontrar movimentos que não fecham, 409 `SALE_STOCK_INCONSISTENT` ("Movimentações de estoque da venda inconsistentes; contate o administrador.").

## 3. Etiquetas com limite (Alto 6)
- `quantity` das etiquetas de produto: 1–500 (400 acima); `productCode` ≤ 100; o use case também valida. PDF enviado em stream quando possível.

## 4. Valores com teto (Altos 8 e 9)
- `salePrice` ≤ 9.999.999.999,99 (create e update de variante) → 400 no campo.
- NF-e: parser rejeita (422 `INVALID_NFE`, "Item n: …") vProd/vNF/qualquer valor monetário > 999.999.999.999 centavos e qCom > 1.000.000; na confirmação, `units = qCom × unitsPerPackage` ≤ 1.000.000 por item e total ≤ teto de Decimal(12,2) → 422 com o índice do item.
- Varredura rápida nos demais schemas monetários/quantidade (vendas, compras, pagamentos, ajustes) para garantir o mesmo teto; onde faltar, adicionar.

## 5. Estoque em caixas consistente (Alto 1)
- Invariante: para cada lote, Σ `InventoryBoxStock.quantity` ≤ `InventoryLot.remainingQuantity`.
- Toda redução de `remainingQuantity` (saída/venda, ajuste para baixo, consumo de reserva se mexer no lote) reduz as alocações daquele lote, na mesma transação, quando a soma passar do saldo: abate das alocações mais antigas primeiro (`createdAt`, depois `id`), apagando as que zerarem. Devolução/entrada não aloca em caixa automaticamente.
- Rota `POST /inventory/boxes/:boxId/items/remove` `{ inventoryLotId, quantity }` (`inventory.write`, idempotente com `Idempotency-Key`) ligando o `RemoveProductFromBoxUseCase` existente (validar e completar).
- Script de correção `npm run fix-box-stock` (idempotente, só ajusta alocações acima do saldo, imprime o que mudou) para os dados já divergentes.

## 6. Banco de testes separado (Médio)
- Testes nunca mais rodam no banco de desenvolvimento: `npm test` usa `TEST_DATABASE_URL` (carregado de `.env`/`.env.test`), copiando-o para `DATABASE_URL` antes de importar o Prisma; guarda no início da suíte: se o nome do banco não terminar em `_test` (ou não for o banco do CI), aborta com mensagem clara.
- `npm run test:db:prepare`: cria o banco de teste se não existir (CREATE DATABASE via conexão administrativa) e roda `prisma migrate deploy` nele. Nunca `reset`/`db push`.
- CI: banco `inventory_test`.
- README: como preparar o banco de teste.

## 7. Backup do banco
- `backend/scripts/backup-db.sh`: `pg_dump` (via `docker exec` no container do Postgres quando `PGCONTAINER` estiver definido, senão `pg_dump` local) com formato custom, arquivo com data/hora em `BACKUP_DIR` (padrão `~/backups/inventory`), retenção de 14 dias; `restore-db.sh` com confirmação explícita e nunca sobre o banco de produção sem `--force`. README com exemplo de cron diário.

## Testes e aceite
Token anterior à troca/redefinição de senha → 401; novo token funciona; origem SALE em /receive → 400; venda com movimento manual estranho → 409 claro em vez de 500; etiquetas 501 → 400; preço acima do teto → 400; NF-e com valores/quantidades acima do teto → 422 com item; saída de lote alocado em caixas reduz as alocações (mais antigas primeiro) e mantém a invariante; remover da caixa; script de correção; suíte roda no banco `_test` e aborta no banco de dev; backup gera arquivo e restore funciona num banco descartável.
Aceite: CI verde; backend `npm test` 3× no banco de teste.
