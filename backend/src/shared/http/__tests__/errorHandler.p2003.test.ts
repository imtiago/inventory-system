import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { registerErrorHandling } from "../errorHandler";

async function call(thrower: () => unknown) {
  const app = Fastify();
  registerErrorHandling(app);
  app.get("/boom", async () => {
    throw thrower();
  });
  const res = await app.inject({ method: "GET", url: "/boom" });
  await app.close();
  return { status: res.statusCode, body: res.json() };
}

const RESOURCE_IN_USE = { message: "Registro em uso por outros dados.", code: "RESOURCE_IN_USE" };

test("P2003 genérico → 409 RESOURCE_IN_USE", async () => {
  const r = await call(
    () =>
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
        code: "P2003",
        clientVersion: "6",
        meta: { field_name: "StockMovement_productVariantId_fkey (index)" },
      }),
  );
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, RESOURCE_IN_USE);
});

test("FK violada em query raw (P2010 meta.code 23503) → 409 RESOURCE_IN_USE", async () => {
  const r = await call(
    () =>
      new Prisma.PrismaClientKnownRequestError("Raw query failed", {
        code: "P2010",
        clientVersion: "6",
        meta: { code: "23503", message: "violates foreign key constraint" },
      }),
  );
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, RESOURCE_IN_USE);
});
