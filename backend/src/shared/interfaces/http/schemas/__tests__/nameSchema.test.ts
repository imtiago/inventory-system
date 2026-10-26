import { test } from "node:test";
import assert from "node:assert/strict";
import { createNameSchema } from "../nameSchema";

const run = (schema: ReturnType<typeof createNameSchema>, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? { ok: r.data } : { error: r.error.issues[0].message };
};

test("nome: apara e colapsa espaços internos", () => {
  const schema = createNameSchema({ max: 120 });
  assert.deepEqual(run(schema, "  Caixa   de \t luvas  "), { ok: "Caixa de luvas" });
});

test("nome: obrigatório, mínimo e máximo com mensagens em PT-BR", () => {
  const schema = createNameSchema({ min: 3, max: 10 });
  assert.deepEqual(run(schema, undefined), { error: "O nome é obrigatório." });
  assert.deepEqual(run(schema, "   "), { error: "O nome deve ter no mínimo 3 caracteres." });
  assert.deepEqual(run(schema, "ab"), { error: "O nome deve ter no mínimo 3 caracteres." });
  assert.deepEqual(run(schema, "a".repeat(11)), { error: "O nome deve ter no máximo 10 caracteres." });
  assert.deepEqual(run(schema, "a".repeat(10)), { ok: "a".repeat(10) });
});

test("nome: com min 1, vazio vira 'obrigatório'", () => {
  assert.deepEqual(run(createNameSchema({ max: 80 }), "  "), { error: "O nome é obrigatório." });
});
