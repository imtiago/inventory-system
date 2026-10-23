import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { app } from "../../../app";
import { createTestUser, TestUser } from "../../../test/authFixtures";
import { hasPermission, Permission, PERMISSIONS, ROLE_PERMISSIONS } from "../permissions";

app.log.level = "silent";

type Role = "ADMIN" | "VENDEDOR" | "ESTOQUISTA";
const ROLES: Role[] = ["ADMIN", "VENDEDOR", "ESTOQUISTA"];

// Matriz aprovada (spec Fase 4A), escrita à mão para não reaproveitar ROLE_PERMISSIONS.
const MATRIX: Record<Permission, Role[]> = {
  "users.manage": ["ADMIN"],
  "catalog.read": ["ADMIN", "VENDEDOR", "ESTOQUISTA"],
  "catalog.write": ["ADMIN", "VENDEDOR", "ESTOQUISTA"],
  "catalog.delete": ["ADMIN"],
  "customers.read": ["ADMIN", "VENDEDOR"],
  "customers.write": ["ADMIN", "VENDEDOR"],
  "sales.read": ["ADMIN", "VENDEDOR"],
  "sales.create": ["ADMIN", "VENDEDOR"],
  "sales.cancel": ["ADMIN", "VENDEDOR"],
  "inventory.read": ["ADMIN", "VENDEDOR", "ESTOQUISTA"],
  "inventory.write": ["ADMIN", "ESTOQUISTA"],
  "finance.read": ["ADMIN", "VENDEDOR"],
  "finance.pay": ["ADMIN", "VENDEDOR"],
  "finance.reverse": ["ADMIN"],
  self: ["ADMIN", "VENDEDOR", "ESTOQUISTA"],
};

/**
 * Uma rota representativa por permissão. Leituras devolvem 2xx de verdade.
 * Escritas usam um corpo inválido ou um id inexistente: o `authorize` roda antes
 * do handler, então o status esperado (400/404) prova que a autorização passou
 * sem gravar nada no banco compartilhado (testes paralelos).
 */
const missing = randomUUID();
const ROUTES: Record<Permission, { method: "GET" | "POST" | "PUT" | "DELETE"; url: string; payload?: object; allowed: number }> = {
  "users.manage": { method: "GET", url: "/users?limit=1", allowed: 200 },
  "catalog.read": { method: "GET", url: "/brands", allowed: 200 },
  "catalog.write": { method: "POST", url: "/brands", payload: {}, allowed: 400 },
  "catalog.delete": { method: "DELETE", url: `/products/${missing}`, allowed: 404 },
  "customers.read": { method: "GET", url: "/customers?limit=1", allowed: 200 },
  "customers.write": { method: "POST", url: "/customers", payload: {}, allowed: 400 },
  "sales.read": { method: "GET", url: "/sales?limit=1", allowed: 200 },
  "sales.create": { method: "POST", url: "/sales", payload: {}, allowed: 400 },
  "sales.cancel": { method: "POST", url: `/sales/${missing}/cancel`, payload: {}, allowed: 404 },
  "inventory.read": { method: "GET", url: "/inventory/dashboard", allowed: 200 },
  "inventory.write": { method: "POST", url: "/inventory/receive", payload: {}, allowed: 400 },
  "finance.read": { method: "GET", url: "/receivables?limit=1", allowed: 200 },
  "finance.pay": {
    method: "POST",
    url: `/receivables/${missing}/parcels/${missing}/payments`,
    payload: {},
    allowed: 400,
  },
  "finance.reverse": {
    method: "POST",
    url: `/receivables/payments/${missing}/reverse`,
    payload: {},
    allowed: 400,
  },
  self: { method: "GET", url: "/users/me", allowed: 200 },
};

describe("hasPermission (matriz)", () => {
  test("cada papel × permissão confere com a matriz da spec", () => {
    for (const permission of PERMISSIONS) {
      for (const role of ROLES) {
        assert.equal(
          hasPermission(role, permission),
          MATRIX[permission].includes(role),
          `${role} × ${permission}`,
        );
      }
    }
    assert.deepEqual([...PERMISSIONS].sort(), Object.keys(MATRIX).sort());
    assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...ROLES].sort());
  });

  test("papel desconhecido não tem permissão", () => {
    assert.equal(hasPermission("admin", "catalog.read"), false);
    assert.equal(hasPermission("CLIENTE", "self"), false);
    for (const odd of ["constructor", "__proto__", "toString", "hasOwnProperty", ""]) {
      assert.equal(hasPermission(odd, "self"), false, odd);
    }
  });
});

describe("matriz por HTTP: papel × rota representativa", () => {
  const users = {} as Record<Role, TestUser>;

  before(async () => {
    for (const role of ROLES) users[role] = await createTestUser({ role });
  });

  after(async () => {
    for (const role of ROLES) await users[role]?.cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  test("para cada papel × rota representativa de cada permissão → 2xx ou 403 conforme a spec", async () => {
    const failures: string[] = [];
    for (const permission of PERMISSIONS) {
      const route = ROUTES[permission];
      for (const role of ROLES) {
        const res = await app.inject({
          method: route.method,
          url: route.url,
          payload: route.payload,
          headers: { authorization: `Bearer ${users[role].token}` },
        });
        const expected = MATRIX[permission].includes(role) ? route.allowed : 403;
        if (res.statusCode !== expected) {
          failures.push(
            `${role} × ${permission} (${route.method} ${route.url}): esperado ${expected}, veio ${res.statusCode} ${res.body.slice(0, 120)}`,
          );
        } else if (expected === 403) {
          assert.deepEqual(res.json(), { message: "Acesso negado.", code: "FORBIDDEN" });
        }
      }
    }
    assert.deepEqual(failures, []);
  });
});
