import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";

import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("Erros HTTP de clientes", () => {
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  test("GET /customers/:id inexistente → 404 CUSTOMER_NOT_FOUND", async () => {
    const token = signTestToken(await getTestUserId());
    const res = await app.inject({
      method: "GET",
      url: `/customers/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, "CUSTOMER_NOT_FOUND");
  });
});
