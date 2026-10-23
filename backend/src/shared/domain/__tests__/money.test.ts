import { test } from "node:test";
import assert from "node:assert/strict";
import { fromCents, toCents } from "../money";

test("toCents arredonda para o centavo mais próximo", () => {
  assert.equal(toCents(10.005), 1001);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(19.9), 1990);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(-10.005), -1001);
});

test("fromCents converte centavos em valor", () => {
  assert.equal(fromCents(1001), 10.01);
  assert.equal(fromCents(30), 0.3);
});
