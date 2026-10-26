import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@shared/prisma";
import { deleteFinancialDocuments } from "../../../../../test/cleanup";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { app } from "../../../../../app";
import { getTestUserId } from "../../../../../test/inventoryFixtures";
import { signTestToken } from "../../../../../test/authFixtures";
import { randomCpf } from "../../../../../test/documentFixtures";
import { PrismaFinancialDocumentReadRepository } from "../../prisma/contracts/PrismaFinancialDocumentReadRepository";
import { PrismaDashboardReadRepository } from "../../../../dashboard/infrastructure/prisma/contracts/PrismaDashboardReadRepository";

app.log.level = "silent";

const TODAY = todayInBusinessTz();
const addDays = (days: number, from = TODAY) => {
  const d = new Date(`${from}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

interface ParcelSeed {
  amount: number;
  dueDate: string;
  payments?: { amount: number; reversed?: boolean }[];
}
type Kind = "RECEIVABLE" | "PAYABLE";
type Status = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED";

describe("Filtro openOnly (GET /receivables e /payables)", () => {
  let token: string;
  let userId: string;
  let customerId: string;
  let supplierId: string;
  const docs: Record<Kind, Record<string, string>> = { RECEIVABLE: {}, PAYABLE: {} };
  const parcelsByDoc = new Map<string, ParcelSeed[]>();

  const get = (url: string) => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });

  const createDoc = async (type: Kind, status: Status, parcels: ParcelSeed[], createdAt: Date) => {
    const doc = await prisma.financialDocument.create({
      data: {
        type,
        originType: type === "RECEIVABLE" ? "SALE" : "PURCHASE",
        originId: randomUUID(),
        partyId: type === "RECEIVABLE" ? customerId : supplierId,
        partyType: type === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
        status,
        createdAt,
      },
    });
    for (const p of parcels) {
      await prisma.financialParcel.create({
        data: {
          financialDocumentId: doc.id,
          amount: p.amount,
          dueDate: asDate(p.dueDate),
          payments: {
            create: (p.payments ?? []).map((pay) => ({
              amount: pay.amount,
              method: "PIX" as const,
              paymentDate: asDate(TODAY),
              createdById: userId,
              ...(pay.reversed ? { reversedAt: new Date(), reversedById: userId, reversalReason: "tx-test estorno" } : {}),
            })),
          },
        },
      });
    }
    parcelsByDoc.set(doc.id, parcels);
    return doc.id;
  };

  const seed = async (type: Kind) => {
    const base = Date.now() - 60_000;
    const at = (i: number) => new Date(base + i * 1000);
    const d = docs[type];
    d.open = await createDoc(type, "OPEN", [{ amount: 100, dueDate: addDays(10) }], at(1));
    d.partial = await createDoc(type, "PARTIALLY_PAID", [{ amount: 100, dueDate: addDays(-2), payments: [{ amount: 40 }] }], at(2));
    d.paid = await createDoc(type, "PAID", [{ amount: 50, dueDate: addDays(3), payments: [{ amount: 50 }] }], at(3));
    d.canceled = await createDoc(type, "CANCELED", [{ amount: 70, dueDate: addDays(3) }], at(4));
    // Estorno devolve o saldo.
    d.reversed = await createDoc(type, "OPEN", [{ amount: 30, dueDate: addDays(50), payments: [{ amount: 30, reversed: true }] }], at(5));
    // Parcela 1 quitada no intervalo; parcela 2 com saldo fora do intervalo.
    d.mixed = await createDoc(
      type,
      "PARTIALLY_PAID",
      [
        { amount: 20, dueDate: addDays(4), payments: [{ amount: 20 }] },
        { amount: 20, dueDate: addDays(60) },
      ],
      at(6),
    );
  };

  before(async () => {
    userId = await getTestUserId();
    token = signTestToken(userId);
    const tag = `tx-test-${randomUUID()}`;
    customerId = (await prisma.customer.create({ data: { name: tag, code: tag } })).id;
    supplierId = (await prisma.supplier.create({ data: { name: tag, document: randomCpf() } })).id;
    await seed("RECEIVABLE");
    await seed("PAYABLE");
  });

  after(async () => {
    try {
      try {
        await deleteFinancialDocuments({ where: { partyId: { in: [customerId, supplierId] } } });
      } finally {
        await prisma.customer.deleteMany({ where: { id: customerId } });
        await prisma.supplier.deleteMany({ where: { id: supplierId } });
      }
    } finally {
      try {
        await app.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  const route = (t: Kind) => (t === "RECEIVABLE" ? "receivables" : "payables");
  const party = (t: Kind) => (t === "RECEIVABLE" ? `customerId=${customerId}` : `supplierId=${supplierId}`);
  const list = async (t: Kind, query: string) => {
    const res = await get(`/${route(t)}?limit=100&${party(t)}&${query}`);
    assert.equal(res.statusCode, 200, res.body);
    return res.json();
  };
  const ids = (body: any) => (body.data.map((x: any) => x.id) as string[]).sort();

  for (const t of ["RECEIVABLE", "PAYABLE"] as const) {
    test(`${route(t)}: openOnly=true mantém parcial/aberto/estornado, tira pago e cancelado; summary coerente`, async () => {
      const d = docs[t];
      const body = await list(t, "openOnly=true");
      assert.deepEqual(ids(body), [d.open, d.partial, d.reversed, d.mixed].sort());
      // Saldos: open 100 (a vencer), partial 60 (vencido), reversed 30 (a vencer), mixed 20 (a vencer).
      assert.equal(body.summary.openAmount, 150);
      assert.equal(body.summary.overdueAmount, 60);
      assert.equal(body.pagination.total, 4);
      // Combinado com status: AND.
      // `partial` tem saldo vencido, então o status de exibição é OVERDUE (regra existente).
      assert.deepEqual(ids(await list(t, "openOnly=true&status=PARTIALLY_PAID")), [d.mixed]);
      assert.deepEqual(ids(await list(t, "openOnly=true&status=OVERDUE")), [d.partial]);
      assert.deepEqual(ids(await list(t, "openOnly=true&status=OPEN")), [d.open, d.reversed].sort());
      assert.deepEqual(ids(await list(t, "openOnly=true&status=PAID")), []);
      assert.deepEqual(ids(await list(t, "openOnly=true&status=CANCELED")), []);
    });

    test(`${route(t)}: openOnly + dueFrom/dueTo exige parcela com saldo dentro do intervalo`, async () => {
      const d = docs[t];
      // Intervalo [+3,+5]: pago/cancelado/mixed(parcela quitada) têm parcela ali, mas sem saldo.
      assert.deepEqual(ids(await list(t, `openOnly=true&dueFrom=${addDays(3)}&dueTo=${addDays(5)}`)), []);
      // Sem openOnly, continuam aparecendo (comportamento atual).
      assert.deepEqual(
        ids(await list(t, `dueFrom=${addDays(3)}&dueTo=${addDays(5)}`)),
        [d.paid, d.canceled, d.mixed].sort(),
      );
      assert.deepEqual(ids(await list(t, `openOnly=true&dueFrom=${addDays(55)}&dueTo=${addDays(65)}`)), [d.mixed]);
      assert.deepEqual(ids(await list(t, `openOnly=true&dueTo=${addDays(-1)}`)), [d.partial]);
    });

    test(`${route(t)}: sem openOnly nada muda; openOnly=false igual; valor inválido → 400`, async () => {
      const all = ids(await list(t, ""));
      assert.equal(all.length, 6);
      assert.deepEqual(ids(await list(t, "openOnly=false")), all);
      for (const bad of ["1", "yes", "TRUE", ""]) {
        const res = await get(`/${route(t)}?${party(t)}&openOnly=${bad}`);
        assert.equal(res.statusCode, 400, `openOnly=${bad}`);
        const err = res.json();
        assert.equal(err.code ?? err.error?.code, "VALIDATION_ERROR");
        assert.match(JSON.stringify(err), /openOnly/);
      }
    });
  }

  test("a lista com openOnly+intervalo coincide com o cartão 'vence em 7 dias' do dashboard", async () => {
    // Data de negócio isolada (injetada) para o dashboard só enxergar os dados deste teste.
    const day = "2097-03-10";
    const mk = (n: number) => addDays(n, day);
    const base = new Date();
    const a = await createDoc("RECEIVABLE", "OPEN", [
      { amount: 10, dueDate: mk(0) },
      { amount: 10, dueDate: mk(7) },
      { amount: 10, dueDate: mk(8) },
    ], base);
    const b = await createDoc("RECEIVABLE", "PARTIALLY_PAID", [{ amount: 10, dueDate: mk(2), payments: [{ amount: 10 }] }, { amount: 5, dueDate: mk(30) }], base);
    const c = await createDoc("RECEIVABLE", "CANCELED", [{ amount: 10, dueDate: mk(1) }], base);
    const dash = await new PrismaDashboardReadRepository().receivables(day);
    const result = await new PrismaFinancialDocumentReadRepository().list(
      "RECEIVABLE" as any,
      { partyId: customerId, openOnly: true, dueFrom: day, dueTo: mk(7) },
      { page: 1, limit: 100 } as any,
      day,
    );
    // Parcelas com saldo em [dia, dia+7]: duas, ambas do documento `a`.
    assert.equal(dash.dueNext7Days.count, 2);
    assert.equal(dash.dueNext7Days.amount, 20);
    assert.deepEqual(result.data.map((x: any) => x.id), [a]);
    assert.ok(![b, c].includes(result.data[0].id));
  });
});
