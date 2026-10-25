import "dotenv/config";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@shared/prisma";
import { createAdmin } from "../createAdmin";

describe("create-admin", () => {
  after(async () => {
    await prisma.$disconnect();
  });

  test("create-admin cria e é idempotente (promove/redefine)", async () => {
    const email = `tx-test-${randomUUID()}@example.com`;
    try {
      const first = await createAdmin({
        name: "tx-test-admin",
        email: `  ${email.toUpperCase()} `,
        password: "senha-inicial-1",
      });
      assert.equal(first.created, true);

      let row = await prisma.user.findUniqueOrThrow({ where: { email } });
      assert.equal(row.role, "ADMIN");
      assert.equal(row.active, true);
      assert.equal(row.name, "tx-test-admin");
      assert.ok(await bcrypt.compare("senha-inicial-1", row.password));
      assert.equal(row.passwordChangedAt, null);

      // rebaixa e desativa: o script deve promover/reativar e redefinir a senha
      await prisma.user.update({
        where: { id: row.id },
        data: { role: "VENDEDOR", active: false },
      });

      const beforeSecond = Date.now();
      const second = await createAdmin({
        name: "tx-test-admin",
        email,
        password: "senha-nova-2",
      });
      assert.equal(second.created, false);
      assert.equal(second.id, row.id);

      row = await prisma.user.findUniqueOrThrow({ where: { email } });
      assert.equal(row.role, "ADMIN");
      assert.equal(row.active, true);
      assert.ok(await bcrypt.compare("senha-nova-2", row.password));
      // redefinir a senha derruba as sessões abertas
      assert.ok(row.passwordChangedAt && row.passwordChangedAt.getTime() >= beforeSecond - 1000, String(row.passwordChangedAt));
      assert.equal(await bcrypt.compare("senha-inicial-1", row.password), false);
      assert.equal(await prisma.user.count({ where: { email } }), 1);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("create-admin rejeita entrada inválida", async () => {
    await assert.rejects(createAdmin({ name: "", email: "x@y.com", password: "senha-valida" }));
    await assert.rejects(createAdmin({ name: "a", email: "invalido", password: "senha-valida" }));
    await assert.rejects(createAdmin({ name: "a", email: "x@y.com", password: "curta" }));
    await assert.rejects(createAdmin({ name: "a", email: "x@y.com", password: "x".repeat(73) }));
  });
});
