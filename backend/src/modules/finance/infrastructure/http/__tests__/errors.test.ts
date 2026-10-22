import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";

app.log.level = "silent";

describe("Erros HTTP de finanças", () => {
  let token: string;
  before(async () => {
    token = jwt.sign({ sub: await getTestUserId(), role: "admin" }, process.env.JWT_SECRET!);
  });
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  const auth = () => ({ authorization: `Bearer ${token}` });

  test("POST /receivables com corpo inválido → 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/receivables",
      headers: auth(),
      payload: { totalAmount: -1, parcels: "x" },
    });
    assert.equal(res.statusCode, 400, res.body);
    assert.equal(res.json().code, "VALIDATION_ERROR");
    assert.ok(res.json().errors.length > 0);
  });
});
