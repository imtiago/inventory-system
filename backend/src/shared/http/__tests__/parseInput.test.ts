import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { parseInput } from "../parseInput";
import { ValidationError } from "../../domain/errors";

test("parseInput aceita válido e retorna dados tipados", () => {
  const out = parseInput(z.object({ n: z.coerce.number() }), { n: "3" });
  assert.deepEqual(out, { n: 3 });
});

test("parseInput inválido lança ValidationError com field aninhado", () => {
  const schema = z.object({ items: z.array(z.object({ quantity: z.number() })) });
  try {
    parseInput(schema, { items: [{ quantity: "x" }] });
    assert.fail("deveria lançar");
  } catch (e) {
    assert.ok(e instanceof ValidationError);
    assert.equal(e.message, "Dados inválidos.");
    assert.equal(e.errors[0].field, "items.0.quantity");
    assert.equal(typeof e.errors[0].message, "string");
  }
});
