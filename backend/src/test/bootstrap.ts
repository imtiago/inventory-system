// Carregado com `--import` antes de qualquer arquivo de teste.
import "dotenv/config";
import { resolveTestDatabaseUrl } from "./testDatabase";

try {
  process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
