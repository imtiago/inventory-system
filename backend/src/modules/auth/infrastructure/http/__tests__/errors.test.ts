import "dotenv/config";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";


app.log.level = "silent";

describe("Erros HTTP de autenticação", () => {
  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  test("POST /auth/login senha errada → 401 INVALID_CREDENTIALS 'Credenciais inválidas.'", async () => {
    const email = `tx-test-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { name: "tx-test-login", email, password: await bcrypt.hash("senha-certa", 4), role: "ADMIN" },
    });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "senha-errada" },
      });
      assert.equal(res.statusCode, 401);
      assert.equal(res.json().code, "INVALID_CREDENTIALS");
      assert.equal(res.json().message, "Credenciais inválidas.");
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  test("POST /users e-mail duplicado → 409 EMAIL_ALREADY_IN_USE", async () => {
    const email = `tx-test-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { name: "tx-test-dup", email, password: "tx-test", role: "ADMIN" },
    });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/users",
        payload: { name: "tx-test-dup", email, password: "12345678" },
      });
      assert.equal(res.statusCode, 409);
      assert.equal(res.json().code, "EMAIL_ALREADY_IN_USE");
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
