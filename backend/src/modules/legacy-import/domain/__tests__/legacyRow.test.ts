import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLegacyRow } from "@legacy-import/domain/legacyRow";
import type { LegacyColumn } from "@legacy-import/domain/legacyTemplate";
import { CreditProfileCode } from "@credit/domain/CreditProfileCode";

const TODAY = "2026-10-30";
const base = (o: Partial<Record<LegacyColumn, string>> = {}): Record<LegacyColumn, string> => ({
  nome: "Maria Silva", celular: "(11) 98888-7777", data_compra: "05/10/2026", descricao: "Sofá",
  valor_total: "100,00", valor_pago: "", vencimentos: "", perfil: "", observacao: "", ...o,
});
const codes = (r: ReturnType<typeof validateLegacyRow>) => r.issues.map((i) => `${i.severity}:${i.code}`);
const check = (o: Partial<Record<LegacyColumn, string>>) => codes(validateLegacyRow(base(o), TODAY));

test("linha válida", () => {
  const r = validateLegacyRow(base(), TODAY);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.data, {
    name: "Maria Silva", phone: "11988887777", purchaseDate: "2026-10-05", description: "Sofá",
    totalCents: 10000, paidCents: 0, openCents: 10000, dueDates: null, profileCode: null, notes: null,
  });
});

test("nome é colapsado; sem nome -> ERROR", () => {
  assert.equal(validateLegacyRow(base({ nome: "  Ana   Paula " }), TODAY).data.name, "Ana Paula");
  assert.deepEqual(check({ nome: " " }), ["ERROR:NAME_REQUIRED"]);
});

test("valores", () => {
  assert.deepEqual(check({ valor_pago: "120,00" }), ["ERROR:PAID_EXCEEDS_TOTAL"]);
  assert.deepEqual(check({ valor_pago: "100,00" }), ["ERROR:ZERO_AMOUNT"]);
  assert.deepEqual(check({ valor_total: "0" }), ["ERROR:ZERO_AMOUNT"]);
  assert.deepEqual(check({ valor_total: "abc" }), ["ERROR:INVALID_AMOUNT"]);
  assert.deepEqual(check({ valor_total: "" }), ["ERROR:INVALID_AMOUNT"]);
  assert.deepEqual(check({ valor_pago: "x" }), ["ERROR:INVALID_AMOUNT"]);
  const r = validateLegacyRow(base({ valor_total: "1.234,56", valor_pago: "34,56" }), TODAY);
  assert.equal(r.data.openCents, 120000);
  assert.deepEqual(r.issues, []);
});

test("celular e data", () => {
  assert.deepEqual(check({ celular: "" }), ["WARNING:NO_PHONE"]);
  const bad = validateLegacyRow(base({ celular: "9888" }), TODAY);
  assert.deepEqual(codes(bad), ["WARNING:INVALID_PHONE"]);
  assert.equal(bad.data.phone, null);
  assert.deepEqual(check({ data_compra: "31/12/2026" }), ["WARNING:FUTURE_DATE"]);
  assert.deepEqual(check({ data_compra: "30/10/2026" }), []);
  assert.deepEqual(check({ data_compra: "" }), ["WARNING:NO_DATE"]);
  const inv = validateLegacyRow(base({ data_compra: "31/02/2026" }), TODAY);
  assert.deepEqual(codes(inv), ["ERROR:INVALID_DATE"]);
  assert.equal(inv.data.purchaseDate, null);
});

test("vencimentos x saldo em aberto", () => {
  const ok = validateLegacyRow(base({ vencimentos: "10/11/2026=50,00; 10/12/2026=50,00" }), TODAY);
  assert.deepEqual(ok.issues, []);
  assert.equal(ok.data.dueDates?.length, 2);
  assert.deepEqual(check({ vencimentos: "10/11/2026=50,00; 10/12/2026=40,00" }), ["ERROR:DUE_DATES_SUM_MISMATCH"]);
  assert.deepEqual(check({ vencimentos: "lixo" }), ["ERROR:INVALID_DUE_DATES"]);
  assert.deepEqual(check({ valor_pago: "40,00", vencimentos: "10/11/2026=60,00" }), []);
});

test("perfil", () => {
  assert.equal(validateLegacyRow(base({ perfil: "excelente" }), TODAY).data.profileCode, CreditProfileCode.EXCELLENT);
  assert.equal(validateLegacyRow(base({ perfil: "Regular" }), TODAY).data.profileCode, CreditProfileCode.REGULAR);
  assert.equal(validateLegacyRow(base({ perfil: " BOM " }), TODAY).data.profileCode, CreditProfileCode.GOOD);
  const v = validateLegacyRow(base({ perfil: "VIP" }), TODAY);
  assert.deepEqual(codes(v), ["ERROR:UNKNOWN_PROFILE"]);
  assert.equal(v.issues[0].field, "perfil");
});

test("observação e descrição vazias viram null", () => {
  const r = validateLegacyRow(base({ descricao: " ", observacao: "  pagar em mãos " }), TODAY);
  assert.equal(r.data.description, null);
  assert.equal(r.data.notes, "pagar em mãos");
});
