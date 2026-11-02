import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { parseCsv } from "../../../../../test/csvParse";
import { CreateFinancialDocumentUseCase } from "@finance/application/useCases/commands/CreateFinancialDocumentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** Review Focus 3: a parcela "a combinar" nunca aparece como vencida. */
describe("parcela a combinar (dueDateUnknown) em contas a receber", () => {
  let token: string;
  let customerId: string;
  let legacyId: string;

  const get = (url: string) => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });

  before(async () => {
    token = signTestToken(await getTestUserId());
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
    // Dívida do caderninho: vencimento gravado 40 dias atrás (data da importação antiga), a combinar.
    const doc = await new CreateFinancialDocumentUseCase(
      new PrismaFinancialDocumentRepository(),
      new PrismaFinancialParcelRepository(),
      new PrismaTransactionManager(),
    ).execute({
      type: FinancialType.RECEIVABLE,
      originType: FinancialOriginType.LEGACY,
      originId: randomUUID(),
      partyType: FinancialPartyType.CUSTOMER,
      partyId: customerId,
      noLateFees: true,
      parcels: [{ amountCents: 15000, dueDate: asDate(addDays(-40)), dueDateUnknown: true }],
    });
    legacyId = doc.id;
  });

  after(async () => {
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: customerId } });
      } finally {
        await prisma.customer.deleteMany({ where: { id: customerId } });
      }
    } finally {
      await app.close();
    }
  });

  test("documento LEGACY com parcela a combinar: lista com status=OVERDUE não traz; resumo overdue 0; detalhe mostra 'A combinar'", async () => {
    const stored = await prisma.financialParcel.findFirstOrThrow({ where: { financialDocumentId: legacyId } });
    assert.equal(stored.dueDateUnknown, true);
    const storedDoc = await prisma.financialDocument.findUniqueOrThrow({ where: { id: legacyId } });
    assert.equal(storedDoc.originType, "LEGACY");
    assert.equal(storedDoc.noLateFees, true);

    const overdue = await get(`/receivables?customerId=${customerId}&status=OVERDUE`);
    assert.equal(overdue.statusCode, 200, overdue.body);
    assert.deepEqual(overdue.json().data, []);
    assert.equal(overdue.json().summary.overdueAmount, 0);

    const all = await get(`/receivables?customerId=${customerId}`);
    assert.equal(all.statusCode, 200, all.body);
    const body = all.json();
    assert.equal(body.data.length, 1);
    const item = body.data[0];
    assert.equal(item.displayStatus, "OPEN");
    assert.equal(item.originType, "LEGACY");
    assert.equal(item.nextDueDate, null);
    assert.equal(item.hasDueDateUnknown, true);
    assert.equal(body.summary.overdueAmount, 0);
    assert.equal(body.summary.openAmount, 150);

    const open = await get(`/receivables?customerId=${customerId}&status=OPEN`);
    assert.deepEqual(open.json().data.map((d: { id: string }) => d.id), [legacyId]);

    // Intervalo de vencimento não enxerga a data fictícia da parcela a combinar.
    const ranged = await get(`/receivables?customerId=${customerId}&dueTo=${TODAY}`);
    assert.deepEqual(ranged.json().data, []);
    assert.equal(ranged.json().summary.openAmount, 0);
    const rangedOpen = await get(`/receivables?customerId=${customerId}&openOnly=true&dueFrom=${addDays(-60)}&dueTo=${TODAY}`);
    assert.deepEqual(rangedOpen.json().data, []);

    const detail = await get(`/receivables/${legacyId}`);
    assert.equal(detail.statusCode, 200, detail.body);
    const d = detail.json().data;
    assert.equal(d.displayStatus, "OPEN");
    assert.equal(d.noLateFees, true);
    assert.equal(d.parcels[0].dueDateUnknown, true);
    assert.equal(d.parcels[0].status, "OPEN");
    assert.deepEqual(d.parcels[0].lateFeesToday, { daysLate: 0, fine: 0, interest: 0, totalDue: 150 });
  });

  test("CSV de contas a receber: origem 'Caderninho', vencimento 'A combinar'", async () => {
    const res = await get(`/reports/receivables.csv?customerId=${customerId}`);
    assert.equal(res.statusCode, 200, res.body);
    const [header, ...rows] = parseCsv(res.body);
    assert.equal(rows.length, 1);
    const cell = (name: string) => rows[0][header.indexOf(name)];
    assert.equal(cell("Origem"), "Caderninho");
    assert.equal(cell("Vencimento"), "A combinar");
    assert.equal(cell("Status"), "Em aberto");

    // Filtro de vencimento também exclui a parcela a combinar da exportação.
    const ranged = parseCsv((await get(`/reports/receivables.csv?customerId=${customerId}&dueTo=${TODAY}`)).body);
    assert.equal(ranged.length, 1, "só o cabeçalho");
  });
});
