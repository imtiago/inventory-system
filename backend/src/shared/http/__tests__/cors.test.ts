import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../../../app";

app.log.level = "silent";

after(async () => {
  await app.close();
});

test("CORS expõe Content-Disposition (nome do CSV) e Idempotent-Replayed ao navegador", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    headers: { origin: "http://localhost:5173" },
    payload: { email: "tx-test-cors@example.com", password: "x" },
  });
  const exposed = String(res.headers["access-control-expose-headers"] ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase());
  assert.ok(exposed.includes("content-disposition"));
  assert.ok(exposed.includes("idempotent-replayed"));
});
