-- Replay de idempotencia reproduz os cabecalhos relevantes da resposta original (Location, Content-Disposition).
ALTER TABLE "IdempotencyRecord" ADD COLUMN "responseHeaders" JSON;
