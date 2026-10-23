import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";

app.log.level = "silent";

describe("Erros HTTP de finanças", () => {
  let token: string;
  before(async () => {
    token = signTestToken(await getTestUserId());
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const auth = () => ({ authorization: `Bearer ${token}` });

  test("POST /receivables → 404 ROUTE_NOT_FOUND (rota removida)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/receivables",
      headers: auth(),
      payload: { totalAmount: 10, parcels: [] },
    });
    assert.equal(res.statusCode, 404, res.body);
    assert.equal(res.json().code, "ROUTE_NOT_FOUND");
  });

  test("GET /receivables continua disponível → 200", async () => {
    const res = await app.inject({ method: "GET", url: "/receivables?page=1&limit=1", headers: auth() });
    assert.equal(res.statusCode, 200, res.body);
  });
});
