import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCents, csvMoney, formatDateBr, formatCentsBr, formatMoneyBr, formatQuantityBr, toCsv } from "../csv";
import { parseCsv } from "../../../test/csvParse";

test("csv: BOM, ';', CRLF e cabeçalho na primeira linha", () => {
  const out = toCsv(["A", "B"], [["x", 1.5], ["y", null]]);
  assert.equal(out, "﻿A;B\r\nx;1,5\r\ny;\r\n");
});

test("csv: aspas duplicadas e campo entre aspas com ';', aspas ou quebra de linha", () => {
  const out = toCsv(["T"], [["a;b"], ['diz "oi"'], ["l1\nl2"], ["l1\r\nl2"], ["simples"]]);
  assert.equal(out, '﻿T\r\n"a;b"\r\n"diz ""oi"""\r\n"l1\nl2"\r\n"l1\r\nl2"\r\nsimples\r\n');
  assert.deepEqual(parseCsv(out).slice(1), [["a;b"], ['diz "oi"'], ["l1\nl2"], ["l1\r\nl2"], ["simples"]]);
});

test("csv: injeção de fórmula neutralizada só em texto; números e valores formatados ficam intactos", () => {
  const out = toCsv(["T", "N", "M"], [
    ["=1+1", -3, csvCents(-1050)],
    ["+x", 2, csvMoney("-0.5")],
    ["-x", 0, csvCents(0)],
    ["@SUM(A1)", 1, csvCents(5)],
    ["\tx", 1, csvCents(5)],
    ["\rx", 1, csvCents(5)],
    ["ok=", 1, csvCents(5)],
  ]);
  const rows = parseCsv(out);
  assert.deepEqual(rows[1], ["'=1+1", "-3", "-10,50"]);
  assert.equal(rows[2][0], "'+x");
  assert.equal(rows[2][2], "-0,50");
  assert.equal(rows[3][0], "'-x");
  assert.equal(rows[4][0], "'@SUM(A1)");
  assert.equal(rows[5][0], "'\tx");
  assert.ok(out.includes('"\'\rx"'));
  assert.equal(rows[7][0], "ok=");
});

test("formatadores pt-BR", () => {
  assert.equal(formatCentsBr(123450), "1234,50");
  assert.equal(formatCentsBr(5), "0,05");
  assert.equal(formatMoneyBr("1234.5"), "1234,50");
  assert.equal(formatMoneyBr("1234"), "1234,00");
  assert.equal(formatMoneyBr("0.005"), "0,01");
  assert.equal(formatMoneyBr("12.344"), "12,34");
  assert.equal(formatMoneyBr("-3.10"), "-3,10");
  assert.equal(formatQuantityBr(1234), "1234");
  assert.equal(formatQuantityBr("2.5"), "2,5");
  assert.equal(formatDateBr("2099-03-07"), "07/03/2099");
});
