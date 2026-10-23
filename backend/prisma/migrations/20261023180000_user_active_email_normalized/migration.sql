-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- Normaliza e-mails existentes (trim + minúsculas)
UPDATE "users" SET "email" = lower(trim("email"));
