-- Marca por usuário: quem pode aprovar crédito (ADMIN sempre pode, pelo papel).
ALTER TABLE "users" ADD COLUMN "canApproveCredit" BOOLEAN NOT NULL DEFAULT false;
