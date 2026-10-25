-- Sessões derrubadas na troca/redefinição de senha (tokens com iat anterior são recusados).
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
