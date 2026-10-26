import "dotenv/config";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { newIdempotencyKey } from "../../../../../test/idempotency";

app.log.level = "silent";

describe("POST /inventory/boxes é idempotente", () => {
  const boxIds: string[] = [];
  const keys: string[] = [];

  const create = async (key?: string) => {
    const token = signTestToken(await getTestUserId());
    const res = await app.inject({
      method: "POST",
      url: "/inventory/boxes",
      headers: { authorization: `Bearer ${token}`, ...(key ? { "idempotency-key": key } : {}) },
    });
    if (res.statusCode === 200 || res.statusCode === 201) boxIds.push(res.json().data.id);
    return res;
  };

  after(async () => {
    try {
      await prisma.inventoryBox.deleteMany({ where: { id: { in: boxIds } } });
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: keys } } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  test("mesma chave → uma só caixa, mesma resposta, com Idempotent-Replayed", async () => {
    const key = newIdempotencyKey();
    keys.push(key);
    const first = await create(key);
    assert.ok([200, 201].includes(first.statusCode), first.body);
    const second = await create(key);
    assert.equal(second.statusCode, first.statusCode);
    assert.equal(second.headers["idempotent-replayed"], "true");
    assert.equal(second.json().data.id, first.json().data.id);
    assert.equal(second.json().data.code, first.json().data.code);
    assert.equal(await prisma.inventoryBox.count({ where: { id: first.json().data.id } }), 1);
    // Só a primeira chamada consumiu um número da sequência.
    assert.equal(new Set(boxIds).size, 1);
  });

  test("chaves diferentes → caixas diferentes", async () => {
    const [k1, k2] = [newIdempotencyKey(), newIdempotencyKey()];
    keys.push(k1, k2);
    const a = await create(k1);
    const b = await create(k2);
    assert.notEqual(a.json().data.id, b.json().data.id);
  });

  test("sem Idempotency-Key a criação continua funcionando (compatível com clientes antigos)", async () => {
    const res = await create();
    assert.ok([200, 201].includes(res.statusCode), res.body);
    assert.equal(res.headers["idempotent-replayed"], undefined);
  });
});
