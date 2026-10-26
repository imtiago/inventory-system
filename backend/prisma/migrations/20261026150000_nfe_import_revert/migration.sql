-- Importação de NF-e desfeita (estorno do recebimento, contas a pagar e pedido cancelados).
-- Só ADD VALUE neste arquivo: o valor novo não pode ser usado na mesma transação em que é
-- criado (PostgreSQL), e nada aqui o usa. A chave de acesso continua única: reenviar a
-- mesma nota reaproveita a linha REVERTED (volta a DRAFT), como já acontecia com a
-- importação cujo pedido foi cancelado.
ALTER TYPE "NfeImportStatus" ADD VALUE IF NOT EXISTS 'REVERTED';
