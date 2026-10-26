import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { readTogether } from "../readTogether";

after(async () => {
  await prisma.$disconnect();
});

const pid = (db: { $queryRaw: typeof prisma.$queryRaw }) =>
  db.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;

test("fora de transação: as leituras usam a mesma conexão (Promise.all pegaria duas do pool)", async () => {
  const [a, b, c] = await readTogether([pid(prisma), pid(prisma), pid(prisma)]);
  assert.equal(a[0].pid, b[0].pid);
  assert.equal(b[0].pid, c[0].pid);
});

test("dentro de transação: usa a conexão da transação, em sequência, e devolve os resultados em ordem", async () => {
  const order: string[] = [];
  const result = await new PrismaTransactionManager().execute(async () => {
    const db = getDb();
    const [first, second, txPid] = await readTogether([
      db.$queryRaw<{ n: number }[]>`SELECT 1 AS n`,
      db.$queryRaw<{ n: number }[]>`SELECT 2 AS n`,
      pid(db),
    ]);
    order.push(`${first[0].n},${second[0].n}`);
    const [again] = await readTogether([pid(db)]);
    return { same: txPid[0].pid === again[0].pid };
  });
  assert.deepEqual(order, ["1,2"]);
  assert.equal(result.same, true);
});

test("resultado vazio e erro propagado", async () => {
  assert.deepEqual(await readTogether([]), []);
  await assert.rejects(() => readTogether([prisma.$queryRaw`SELECT * FROM "TabelaQueNaoExiste"`]));
});
