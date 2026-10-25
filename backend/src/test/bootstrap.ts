// Carregado com `--import` antes de qualquer arquivo de teste.
import "dotenv/config";
import { resolveTestDatabaseUrl } from "./testDatabase";

try {
  process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

// O rate limit global não deve interferir na suíte (os testes dele injetam limites).
process.env.RATE_LIMIT_DISABLED ??= "1";
