import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("Erros HTTP de vendas", () => {
  let token: string;
  before(async () => {
    token = signTestToken(await getTestUserId());
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const auth = () => ({ authorization: `Bearer ${token}` });

  test("POST /sales cliente inexistente → 404 CUSTOMER_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sales",
      headers: auth(),
      payload: {
        customerId: randomUUID(),
        items: [{ productVariantId: randomUUID(), quantity: 1 }],
        paymentTerms: { installments: 1 },
      },
    });
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "CUSTOMER_NOT_FOUND");
  });

  test("POST /sales corpo inválido → 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({ method: "POST", url: "/sales", headers: auth(), payload: { items: [] } });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(res.json().errors));
  });

  test("GET /sales/:id inexistente → 404 SALE_NOT_FOUND", async () => {
    const res = await app.inject({ method: "GET", url: `/sales/${randomUUID()}`, headers: auth() });
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "SALE_NOT_FOUND");
  });
});
