-- Cliente: CPF/CNPJ opcional (só dígitos/letras, normalizado pela aplicação).
-- Índice único PARCIAL: vários clientes sem documento convivem; o Prisma não modela
-- índice parcial, então ele existe só aqui (ver comentário no schema.prisma).
-- Violação → P2002 → 409 CUSTOMER_DOCUMENT_EXISTS.
ALTER TABLE "Customer" ADD COLUMN "document" TEXT;

CREATE UNIQUE INDEX "Customer_document_key" ON "Customer" ("document") WHERE "document" IS NOT NULL;
