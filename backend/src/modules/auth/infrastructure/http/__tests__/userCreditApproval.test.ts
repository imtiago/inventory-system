import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../../../app";
import { createTestUser, TestUser } from "../../../../../test/authFixtures";
import { readFileSync } from "node:fs";
import { keyShape } from "../../../../../test/keyShape";

app.log.level = "silent";

describe("canApproveCredit por usuário", () => {
  let admin: TestUser;
  let seller: TestUser;
  let approver: TestUser;

  before(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    seller = await createTestUser({ role: "VENDEDOR" });
    approver = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
  });
  after(async () => {
    for (const u of [admin, seller, approver]) await u?.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  const auth = (u: TestUser) => ({ authorization: `Bearer ${u.token}` });

  test("PATCH canApproveCredit false → mesmo token já recebe 403 em /credit/approvers/me", async () => {
    const target = await createTestUser({ role: "VENDEDOR", canApproveCredit: true });
    try {
      const ok = await app.inject({ method: "GET", url: "/credit/approvers/me", headers: auth(target) });
      assert.equal(ok.statusCode, 200);
      assert.deepEqual(ok.json(), { data: { canApprove: true } });

      const patch = await app.inject({
        method: "PATCH", url: `/users/${target.id}`, headers: auth(admin), payload: { canApproveCredit: false },
      });
      assert.equal(patch.statusCode, 200);
      assert.equal(patch.json().data.canApproveCredit, false);

      const denied = await app.inject({ method: "GET", url: "/credit/approvers/me", headers: auth(target) });
      assert.equal(denied.statusCode, 403);

      await app.inject({ method: "PATCH", url: `/users/${target.id}`, headers: auth(admin), payload: { canApproveCredit: true } });
      const again = await app.inject({ method: "GET", url: "/credit/approvers/me", headers: auth(target) });
      assert.equal(again.statusCode, 200);
    } finally {
      await target.cleanup();
    }
  });

  test("/users/me e a lista devolvem canApproveCredit", async () => {
    const me = await app.inject({ method: "GET", url: "/users/me", headers: auth(approver) });
    assert.equal(me.json().data.canApproveCredit, true);
    const me2 = await app.inject({ method: "GET", url: "/users/me", headers: auth(seller) });
    assert.equal(me2.json().data.canApproveCredit, false);
    const list = await app.inject({ method: "GET", url: `/users?search=${encodeURIComponent(approver.email)}`, headers: auth(admin) });
    assert.equal(list.json().data[0].canApproveCredit, true);
  });

  test("não-ADMIN não altera a marca (users.manage)", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/users/${seller.id}`, headers: auth(approver), payload: { canApproveCredit: true },
    });
    assert.equal(res.statusCode, 403);
  });

  test("GET /credit/approvers lista ativos com credit.approve (ADMIN e marcados), para quem vende", async () => {
    const inactive = await createTestUser({ role: "VENDEDOR", canApproveCredit: true, active: false });
    try {
      const res = await app.inject({ method: "GET", url: "/credit/approvers", headers: auth(seller) });
      assert.equal(res.statusCode, 200);
      const ids = (res.json().data as { id: string; name: string; email: string }[]).map((u) => u.id);
      assert.ok(ids.includes(admin.id));
      assert.ok(ids.includes(approver.id));
      assert.ok(!ids.includes(seller.id));
      assert.ok(!ids.includes(inactive.id));
      assert.deepEqual(Object.keys(res.json().data[0]).sort(), ["email", "id", "name"]);
      // Contrato com o modal de autorização do front.
      const fixture = JSON.parse(
        readFileSync(new URL("../../../../../../../frontend/src/test/fixtures/credit/creditApprovers.json", import.meta.url), "utf8"),
      );
      assert.deepEqual(keyShape(res.json()), keyShape(fixture));
    } finally {
      await inactive.cleanup();
    }
  });

  test("ESTOQUISTA não acessa /credit/approvers (sales.create)", async () => {
    const e = await createTestUser({ role: "ESTOQUISTA", canApproveCredit: true });
    try {
      const res = await app.inject({ method: "GET", url: "/credit/approvers", headers: auth(e) });
      assert.equal(res.statusCode, 403);
    } finally {
      await e.cleanup();
    }
  });

  test("POST /users aceita canApproveCredit; login devolve a marca", async () => {
    const email = `tx-test-${randomUUID()}@example.com`;
    const res = await app.inject({
      method: "POST", url: "/users", headers: auth(admin),
      payload: { name: "tx-test-novo", email, password: "SenhaForte123", role: "VENDEDOR", canApproveCredit: true },
    });
    try {
      assert.equal(res.statusCode, 201, res.body);
      assert.equal(res.json().data.canApproveCredit, true);
      const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "SenhaForte123" } });
      assert.equal(login.statusCode, 200, login.body);
      assert.equal(login.json().data.user.canApproveCredit, true);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});
