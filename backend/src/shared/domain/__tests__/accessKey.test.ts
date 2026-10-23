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
