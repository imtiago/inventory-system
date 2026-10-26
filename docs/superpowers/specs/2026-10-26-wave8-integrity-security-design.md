# Onda 8 — Integridade, catálogo e segurança

**Data:** 2026-10-26
**Status:** decidido (usuário: "pode seguir"). Fecha os últimos achados médios da revisão geral (`docs/reviews/2026-10-25-revisao-geral.md`; situação em `docs/reviews/2026-10-25-pendencias-apos-onda3.md`).

## 1. Regras de dinheiro e estoque no banco ("Sem CHECK nem unicidade de origem")
- Antes de criar, conferir que os dados atuais (dev) respeitam cada regra; se não, parar e relatar (nunca alterar dado para a regra passar sem decisão).
- Migration com `CHECK`: `Inventory.quantity >= 0`, `reservedQuantity BETWEEN 0 AND quantity`, `InventoryLot.remainingQuantity >= 0` (e `<= initialQuantity` se existir), `InventoryBoxStock.quantity > 0`, `Payment.amount > 0`, `FinancialParcel.amount > 0`, `SaleItem.quantity > 0`, `PurchaseItem.quantity > 0` (nomes de coluna conforme o schema).
- Índice único parcial `FinancialDocument (type, "originType", "originId") WHERE "originType" IN ('SALE','PURCHASE') AND status <> 'CANCELED'` — confirmar que nenhum fluxo cria dois documentos ativos para a mesma origem (estorno de NF-e cancela antes de reimportar).
- Violação de CHECK (Postgres 23514) traduzida para 409 `CONSTRAINT_VIOLATION` "Operação recusada: deixaria dados inconsistentes." no errorHandler (é um erro de programação/corrida, não validação comum; logar com detalhe).

## 2. Migrations antigas com dados ("Migrations que falham em banco com dados")
- Não reescrever migrations já aplicadas (mudaria o checksum). README ganha a seção "Banco legado" com o procedimento manual para bancos criados antes de out/2026 (backfill de `Customer.code` pela faixa `CUSTOMER`, deduplicação de e-mails antes de `user_active_email_normalized`, `prisma migrate resolve --applied`), com SQL de conferência pronto.

## 3. Código de barras ("corrida vira 409 genérico, sem limite de tamanho")
- `barcode` com `.trim().max(64)` nos schemas de criar/editar variante e produto; P2002 com target `barcode` → 409 `BARCODE_ALREADY_EXISTS` (mensagem existente) nos repositórios.

## 4. Edição de produto e variante sem atualização perdida
- Update grava só os campos enviados/alterados (como `PrismaCustomerRepository.update`) e trava a linha (`lockById` existente) antes de ler; marca/categoria validadas dentro da mesma transação.

## 5. Resumo de contas respeita o vencimento ("Resumo da lista ignora intervalo")
- Com `dueFrom`/`dueTo`, os totais A vencer / Vencido / Recebido(Pago) consideram só as parcelas no intervalo (mesma regra da exportação). Sem intervalo, igual a hoje.

## 6. CSV de itens vendidos
- Colunas Produto e Variante com os valores certos (produto = nome do produto; variante = nome da variante). Teste com nomes distintos.

## 7. Login: limite por IP e por conta ("Limitador de login em memória")
- Além de IP+e-mail (10/15 min), limite por conta (e-mail) 30/15 min de qualquer IP e por IP 50/15 min de qualquer e-mail; mensagem 429 existente. Estado continua em memória (instância única) — documentar no README que múltiplas instâncias exigem armazenamento compartilhado.

## 8. Sessão entre abas ("Token em localStorage; logout não sincronizado")
- Listener de `storage`: logout em uma aba desloga as outras; login/troca de token em outra aba atualiza esta (sem recarregar dados de outro usuário: troca de usuário limpa o cache).
- Todas as escritas em `localStorage` com try/catch (navegação privada/armazenamento bloqueado não quebra o login, só não persiste).
- Token continua em `localStorage` (decisão registrada: mover para cookie httpOnly exige CSRF e mudança de deploy; fora do escopo).

## Testes e aceite
Cada item com teste que falha antes. Aceite: CI verde; backend `npm test` 2× no banco de teste; frontend lint/typecheck/testes/build; migration aditiva com backup antes.
