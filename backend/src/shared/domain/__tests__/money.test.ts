import { test } from "node:test";
import assert from "node:assert/strict";
import { divideCentsRoundHalfUp, fromCents, toCents } from "../money";

test("toCents arredonda para o centavo mais próximo", () => {
  assert.equal(toCents(10.005), 1001);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(19.9), 1990);
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents(2.675), 268);
  assert.equal(toCents(-1.005), -101);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(-10.005), -1001);
});

test("fromCents converte centavos em valor", () => {
  assert.equal(fromCents(1001), 10.01);
  assert.equal(fromCents(30), 0.3);
});

test("divideCentsRoundHalfUp: divisão inteira com meio para cima", () => {
  assert.equal(divideCentsRoundHalfUp(1000, 3), 333);
  assert.equal(divideCentsRoundHalfUp(2075, 2), 1038);
  assert.equal(divideCentsRoundHalfUp(5, 2), 3);
  assert.equal(divideCentsRoundHalfUp(2, 3), 1);
  assert.equal(divideCentsRoundHalfUp(1, 3), 0);
  assert.equal(divideCentsRoundHalfUp(0, 7), 0);
  assert.throws(() => divideCentsRoundHalfUp(10, 0));
  assert.throws(() => divideCentsRoundHalfUp(1.5, 2));
});
