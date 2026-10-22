import { test } from "node:test";
import assert from "node:assert/strict";
import { loadEnv } from "../env";

test("loadEnv retorna JWT_SECRET", () => {
  assert.deepEqual(loadEnv({ JWT_SECRET: "abc" }), { JWT_SECRET: "abc" });
});

test("loadEnv sem JWT_SECRET lança 'JWT_SECRET não definido.'", () => {
  assert.throws(() => loadEnv({}), { message: "JWT_SECRET não definido." });
});

test("loadEnv com JWT_SECRET vazio lança", () => {
  assert.throws(() => loadEnv({ JWT_SECRET: "" }), { message: "JWT_SECRET não definido." });
});
