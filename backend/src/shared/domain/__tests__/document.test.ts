import { test } from "node:test";
import assert from "node:assert/strict";
import { documentTypeOf, isValidCnpj, isValidCpf, normalizeDocument } from "../document";

test("normalizeDocument remove tudo que não é dígito", () => {
  assert.equal(normalizeDocument("529.982.247-25"), "52998224725");
  assert.equal(normalizeDocument(" 11.222.333/0001-81 "), "11222333000181");
  assert.equal(normalizeDocument("abc"), "ABC");
  assert.equal(normalizeDocument("12.abc.345/01de-35"), "12ABC34501DE35");
});

test("CPF/CNPJ válidos aceitos (com e sem máscara); dígito verificador errado e sequência repetida → inválido", () => {
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("11111111111"), false);
  assert.equal(isValidCpf("5299822472"), false);

  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000182"), false);
  assert.equal(isValidCnpj("00000000000000"), false);
  assert.equal(isValidCnpj("1122233300018"), false);
});

test("CNPJ alfanumérico (IN RFB 2.229/2024): 12 posições [0-9A-Z] + 2 DVs numéricos (valor = código ASCII − 48)", () => {
  assert.equal(isValidCnpj("12ABC34501DE35"), true);
  assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
  assert.equal(isValidCnpj("12.abc.345/01de-35"), true, "máscara e minúsculas normalizadas");
  assert.equal(isValidCnpj("A1B2C3D4000193"), true);
  assert.equal(isValidCnpj("12ABC34501DE36"), false, "DV errado");
  assert.equal(isValidCnpj("12ABC34501DEA5"), false, "DV não numérico");
  assert.equal(isValidCnpj("AAAAAAAAAAAAAA"), false);
  assert.equal(isValidCpf("5299822472A"), false, "CPF continua só numérico");
  assert.equal(documentTypeOf("12ABC34501DE35"), "CNPJ");
});

test("documentTypeOf deriva CPF/CNPJ só de documentos válidos", () => {
  assert.equal(documentTypeOf("52998224725"), "CPF");
  assert.equal(documentTypeOf("11222333000181"), "CNPJ");
  assert.equal(documentTypeOf("52998224724"), null);
  assert.equal(documentTypeOf("123"), null);
});
