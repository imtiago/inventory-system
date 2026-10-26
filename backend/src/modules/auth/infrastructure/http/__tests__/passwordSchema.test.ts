import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordSchema } from "@auth/interfaces/http/schemas/createUserSchema";

const messageOf = (value: string) => {
  const result = passwordSchema.safeParse(value);
  return result.success ? null : result.error.issues[0].message;
};

test("senha com até 72 bytes é aceita (72 ASCII)", () => {
  assert.equal(messageOf("a".repeat(72)), null);
});

test("senha com mais de 72 bytes é recusada, não truncada", () => {
  assert.equal(messageOf("a".repeat(73)), "A senha deve ter no máximo 72 bytes.");
});

test("o limite conta bytes UTF-8: 37 caracteres acentuados = 74 bytes → recusada", () => {
  const accented = "é".repeat(37); // 37 caracteres, 74 bytes
  assert.equal(accented.length, 37);
  assert.equal(messageOf(accented), "A senha deve ter no máximo 72 bytes.");
  assert.equal(messageOf("é".repeat(36)), null); // 72 bytes
});

test("mínimo de 8 caracteres continua valendo", () => {
  assert.equal(messageOf("curta"), "A senha deve ter ao menos 8 caracteres.");
});
