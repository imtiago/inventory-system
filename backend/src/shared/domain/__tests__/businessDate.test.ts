import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { businessTodayAsUtcDate, todayInBusinessTz } from "../businessDate";
import { createSaleSchema } from "../../../modules/sales/interfaces/http/schemas/createSaleSchema";

describe("todayInBusinessTz", () => {
  test("23:30 em São Paulo (02:30Z do dia seguinte) ainda é o dia local", () => {
    assert.equal(todayInBusinessTz(new Date("2026-10-22T23:30:00-03:00")), "2026-10-22");
    assert.equal(todayInBusinessTz(new Date("2026-10-23T02:30:00Z")), "2026-10-22");
  });

  test("default de vencimento à vista é o dia local", () => {
    const d = businessTodayAsUtcDate(new Date("2026-10-23T02:30:00Z"));
    assert.equal(d.toISOString().slice(0, 10), "2026-10-22");
  });

  test("createSaleSchema aceita firstDueDate = hoje local quando UTC já virou o dia", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-22T23:30:00-03:00") });
    const parsed = createSaleSchema.safeParse({
      customerId: "11111111-1111-4111-8111-111111111111",
      items: [{ productVariantId: "22222222-2222-4222-8222-222222222222", quantity: 1 }],
      paymentTerms: { installments: 2, firstDueDate: "2026-10-22" },
    });
    assert.equal(parsed.success, true);
  });
});

describe("businessDateOfInstant", () => {
  test("data-hora ISO com fuso → data no fuso de negócio", async () => {
    const { businessDateOfInstant } = await import("../businessDate");
    assert.equal(businessDateOfInstant("2026-10-23T23:30:00-03:00"), "2026-10-23");
    assert.equal(businessDateOfInstant("2026-10-24T02:30:00Z"), "2026-10-23");
    assert.equal(businessDateOfInstant("2026-10-24T01:30:00-01:00"), "2026-10-23");
    assert.equal(businessDateOfInstant("2026-10-23T23:30:00"), null, "sem fuso é ambíguo");
    assert.equal(businessDateOfInstant("23/10/2026"), null);
    assert.equal(businessDateOfInstant("2026-13-40T10:00:00-03:00"), null);
  });
});
