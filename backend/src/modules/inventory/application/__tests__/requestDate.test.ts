import { test } from "node:test";
import assert from "node:assert/strict";
import { requestDate } from "../../interfaces/http/schemas/requestDate";

test("requestDate: data sem hora vira meia-noite UTC", () => {
  assert.equal(requestDate.parse("2026-10-25").toISOString(), "2026-10-25T00:00:00.000Z");
});

test("requestDate: instante com hora vira a data do fuso de negócio", () => {
  assert.equal(requestDate.parse("2026-10-25T23:30:00-03:00").toISOString(), "2026-10-25T00:00:00.000Z");
  assert.equal(requestDate.parse("2026-10-24T22:00:00-03:00").toISOString(), "2026-10-24T00:00:00.000Z");
  assert.equal(requestDate.parse("2026-10-26T01:00:00Z").toISOString(), "2026-10-25T00:00:00.000Z");
});

test("requestDate: rejeita null, vazio e inválido", () => {
  assert.throws(() => requestDate.parse(null));
  assert.throws(() => requestDate.parse(""));
  assert.throws(() => requestDate.parse("abc"));
});

test("requestDate: meia-noite UTC (convenção do frontend) é mantida", () => {
  assert.equal(requestDate.parse("2026-01-15T00:00:00.000Z").toISOString(), "2026-01-15T00:00:00.000Z");
});
