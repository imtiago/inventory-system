import "dotenv/config";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { prisma } from "@shared/prisma";
import { idempotent } from "../idempotent";

// Rota mínima: o controller define Location e Content-Disposition; o replay deve reproduzi-los.
const userId = `tx-test-${randomUUID()}`;
const app = Fastify();
let executions = 0;

before(async () => {
  app.decorateRequest("user", undefined as never);
  app.addHook("onRequest", async (request) => {
    (request as unknown as { user: { sub: string } }).user = { sub: userId };
  });
  app.post(
    "/things",
    idempotent(async (_request, reply) => {
      executions += 1;
      return reply
        .status(201)
        .header("Location", "/things/abc")
        .header("Content-Disposition", 'attachment; filename="x.json"')
        .header("X-Not-Replayed", "1")
        .send({ data: { id: "abc" } });
    }),
  );
  await app.ready();
});

after(async () => {
  await prisma.idempotencyRecord.deleteMany({ where: { userId } });
  await app.close();
});

test("replay reproduz Location e Content-Disposition da resposta original, e só os relevantes", async () => {
  const key = `k-${randomUUID()}`;
  const call = () =>
    app.inject({ method: "POST", url: "/things", payload: { a: 1 }, headers: { "idempotency-key": key } });

  const first = await call();
  assert.equal(first.statusCode, 201);
  assert.equal(first.headers.location, "/things/abc");

  const replay = await call();
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.headers["idempotent-replayed"], "true");
  assert.equal(replay.headers.location, "/things/abc");
  assert.equal(replay.headers["content-disposition"], 'attachment; filename="x.json"');
  assert.equal(replay.headers["x-not-replayed"], undefined);
  assert.deepEqual(replay.json(), first.json());
  assert.equal(executions, 1);
});
