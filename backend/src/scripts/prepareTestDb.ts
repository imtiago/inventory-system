// Cria o banco de testes (se não existir) e aplica as migrations. Idempotente.
//   npm run test:db:prepare
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertTestDatabase, databaseName, withDatabaseName } from "../test/testDatabase";

export async function prepareTestDb(testUrl: string | undefined): Promise<void> {
  const url = assertTestDatabase(testUrl);
  const name = databaseName(url);
  const admin = new PrismaClient({ datasourceUrl: withDatabaseName(url, "postgres") });
  try {
    const found = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (found.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      console.log(`Banco ${name} criado.`);
    }
  } finally {
    await admin.$disconnect();
  }
  const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  if (res.status !== 0) throw new Error("prisma migrate deploy falhou.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  prepareTestDb(env.TEST_DATABASE_URL || (env.CI === "true" ? env.DATABASE_URL : undefined)).catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
}
