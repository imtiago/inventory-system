import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../test/cleanup";
import { acquireCreditTestLock } from "../../test/creditTestLock";
import { createCrediarioSaleOrigin, deleteCustomerSales, resetCreditDefaults } from "../../test/creditFixtures";
import { checkReviewDatabase, formatReviewSummary, parseCreditReviewArgs, runCreditReview } from "../creditReview";

const DAY = 86_400_000;
const today = todayInBusinessTz();
const at = (days: number) => new Date(Date.parse(`${today}T00:00:00.000Z`) + days * DAY);

describe("credit-review (script mensal)", () => {
  test("recusa banco _test sem --allow-test; aceita com a opção; banco comum passa", () => {
    assert.match(checkReviewDatabase("postgresql://u:p@h:5432/inventory_test", false) ?? "", /--allow-test/);
    assert.equal(checkReviewDatabase("postgresql://u:p@h:5432/inventory_test", true), null);
    assert.equal(checkReviewDatabase("postgresql://u:p@h:5432/inventory", false), null);
    assert.match(checkReviewDatabase(undefined, false) ?? "", /DATABASE_URL/);
  });

  test("argumentos: --allow-test; desconhecido → erro", () => {
    assert.deepEqual(parseCreditReviewArgs([]), { allowTest: false });
    assert.deepEqual(parseCreditReviewArgs(["--allow-test"]), { allowTest: true });
    assert.throws(() => parseCreditReviewArgs(["--foo"]), /desconhecido/);
  });

  test("resumo: 'N clientes revisados: X subiram, Y desceram, Z suspensos'", () => {
    const item = (action: "UP" | "DOWN" | "SUSPEND") => ({ action }) as never;
    assert.equal(
      formatReviewSummary([item("UP"), item("UP"), item("DOWN"), item("SUSPEND")]),
      "4 clientes revisados: 2 subiram, 1 desceram, 1 suspensos",
    );
    assert.equal(formatReviewSummary([]), "0 clientes revisados: 0 subiram, 0 desceram, 0 suspensos");
  });

  describe("execução", () => {
    const customerIds: string[] = [];
    let releaseLock: () => Promise<void>;
    before(async () => {
      releaseLock = await acquireCreditTestLock();
      await resetCreditDefaults();
    });
    after(async () => {
      try {
        await deleteFinancialDocuments({ where: { partyId: { in: customerIds } } });
        await deleteCustomerSales(customerIds);
        await prisma.creditLimitChange.deleteMany({ where: { customerId: { in: customerIds } } });
        await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
      } finally {
        await releaseLock?.();
        await prisma.$disconnect();
      }
    });

    test("aplica direto (AUTO_REVIEW, sem autor), imprime o resumo e a segunda execução não muda nada", async () => {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "Customer" (id, name, code, "createdAt")
        VALUES (${id}, ${`tx-test-rev-${id.slice(0, 8)}`}, ${`TX${id.slice(0, 12)}`},
                ((${today}::date - make_interval(months => 3))::timestamp + interval '15 hours'))`;
      customerIds.push(id);
      const doc = await prisma.financialDocument.create({
        data: { type: "RECEIVABLE", originType: "SALE", originId: await createCrediarioSaleOrigin(id), partyId: id, partyType: "CUSTOMER", status: "PAID" },
      });
      for (let i = 0; i < 9; i++) {
        const parcel = await prisma.financialParcel.create({ data: { financialDocumentId: doc.id, amount: 50, dueDate: at(-80 + i * 5) } });
        await prisma.payment.create({ data: { parcelId: parcel.id, amount: 50, method: "CASH", paymentDate: at(-80 + i * 5) } });
      }
      const lines: string[] = [];
      const items = await runCreditReview({ customerIds: [id], log: (l) => lines.push(l) });
      assert.equal(items.length, 1);
      assert.match(lines.join("\n"), /1 clientes revisados: 1 subiram, 0 desceram, 0 suspensos/);
      assert.ok(lines.some((l) => l.includes("subiu para Regular: 9 parcelas em dia, 0 atrasos")));
      const change = await prisma.creditLimitChange.findFirstOrThrow({ where: { customerId: id } });
      assert.equal(change.source, "AUTO_REVIEW");
      assert.equal(change.changedById, null);
      assert.deepEqual(await runCreditReview({ customerIds: [id], log: () => {} }), []);
      assert.equal(await prisma.creditLimitChange.count({ where: { customerId: id } }), 1);
    });
  });
});
