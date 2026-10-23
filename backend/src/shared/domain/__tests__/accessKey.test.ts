import { test } from "node:test";
import assert from "node:assert/strict";
import { accessKeyCheckDigit, isValidAccessKey } from "../accessKey";

test("DV da chave: módulo 11, pesos 2..9 da direita; resto 0 ou 1 → 0", () => {
  assert.equal(accessKeyCheckDigit("3526101122233300018155001000012345112345678"), 4);
  assert.equal(accessKeyCheckDigit("3526100005299822472555001000000077112345678"), 0);
  assert.equal(isValidAccessKey("35261011222333000181550010000123451123456784"), true);
  assert.equal(isValidAccessKey("35261011222333000181550010000123451123456785"), false);
  assert.equal(isValidAccessKey("3526101122233300018155001000012345112345678"), false);
  assert.equal(isValidAccessKey("3526101122233300018155001000012345112345678a"), false);
});

test("chave com CNPJ alfanumérico (NT 2025.001): DV com valor = código ASCII − 48", () => {
  assert.equal(accessKeyCheckDigit("35261012ABC34501DE3555001000000500112345678"), 1);
  assert.equal(isValidAccessKey("35261012ABC34501DE35550010000005001123456781"), true);
  assert.equal(isValidAccessKey("35261012ABC34501DE35550010000005001123456782"), false);
  assert.equal(isValidAccessKey("35261012abc34501de35550010000005001123456781"), false, "minúsculas não");
  assert.equal(isValidAccessKey("3526101122233300018155A010000123451123456784"), false, "letra fora do CNPJ");
});
