import "dotenv/config";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@shared/prisma";
import { runInTransactionContext } from "@shared/infrastructure/prisma/transactionContext";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialListFilters } from "@finance/application/dto/FinancialDocumentReadDTO";
import { getTestUserId } from "../../../../../../test/inventoryFixtures";
import { randomCpf } from "../../../../../../test/documentFixtures";
import { PrismaFinancialDocumentReadRepository } from "../PrismaFinancialDocumentReadRepository";

/*
 * Equivalência da lista / resumo / exportação de contas a receber e a pagar.
 *
 * O snapshot (__snapshots__/financialReadEquivalence.json) foi gerado com a implementação
 * anterior (cálculo em memória) e fixa o resultado exato de cada combinação de filtros;
 * a implementação em SQL precisa devolver o mesmo, byte a byte (ids normalizados em rótulos).
 * Regerar só de propósito: UPDATE_FINANCE_SNAPSHOT=1.
 *
 * "Hoje" é injetado (2096-05-15) e todos os vencimentos ficam em 2096 — janela que nenhuma
 * outra suíte usa. As consultas sem contraparte são delimitadas por esse intervalo de vencimento.
 */

const SNAPSHOT = new URL("./__snapshots__/financialReadEquivalence.json", import.meta.url);
const TODAY = "2096-05-15";
const SCOPE = { dueFrom: "2096-01-01", dueTo: "2096-12-31" };
const addDays = (days: number) => {
  const d = new Date(`${TODAY}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const at = (seconds: number) => new Date(Date.UTC(2096, 0, 1, 0, 0, seconds));

type Kind = "RECEIVABLE" | "PAYABLE";
type Status = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELED";
interface ParcelSeed {
  amount: number;
  due: number;
  payments?: { amount: number; reversed?: boolean }[];
}
interface DocSeed {
  label: string;
  party: "A" | "B" | "unknown";
  status: Status;
  parcels: ParcelSeed[];
  createdAt: Date;
  /** Origem = compra real (só a pagar), para o purchaseCode. */
  withPurchase?: boolean;
  only?: Kind;
}

const SEEDS: DocSeed[] = [
  { label: "openLater", party: "A", status: "OPEN", parcels: [{ amount: 100, due: 10 }], createdAt: at(1) },
  { label: "openToday", party: "B", status: "OPEN", parcels: [{ amount: 80, due: 0 }], createdAt: at(2) },
  { label: "overdue", party: "A", status: "OPEN", parcels: [{ amount: 50, due: -5 }, { amount: 50, due: 25 }], createdAt: at(3) },
  {
    label: "partialOverdue",
    party: "B",
    status: "PARTIALLY_PAID",
    parcels: [{ amount: 100, due: -2, payments: [{ amount: 40 }] }],
    createdAt: at(4),
  },
  {
    label: "partialFuture",
    party: "A",
    status: "PARTIALLY_PAID",
    parcels: [
      { amount: 60, due: 5, payments: [{ amount: 60 }] },
      { amount: 60, due: 30, payments: [{ amount: 10.55 }] },
    ],
    createdAt: at(5),
  },
  {
    label: "paid",
    party: "B",
    status: "PAID",
    parcels: [
      { amount: 50, due: -10, payments: [{ amount: 50 }] },
      { amount: 25.25, due: 3, payments: [{ amount: 25.25 }] },
    ],
    createdAt: at(6),
  },
  { label: "canceled", party: "A", status: "CANCELED", parcels: [{ amount: 70, due: -3 }], createdAt: at(7) },
  {
    label: "canceledPaid",
    party: "B",
    status: "CANCELED",
    parcels: [{ amount: 40, due: 4, payments: [{ amount: 15 }] }],
    createdAt: at(8),
  },
  {
    label: "reversed",
    party: "A",
    status: "OPEN",
    parcels: [{ amount: 30, due: 10, payments: [{ amount: 30, reversed: true }] }],
    createdAt: at(9),
  },
  {
    label: "reversedPartial",
    party: "B",
    status: "PARTIALLY_PAID",
    parcels: [{ amount: 90, due: -1, payments: [{ amount: 20 }, { amount: 50, reversed: true }] }],
    createdAt: at(10),
  },
  // Mesmo createdAt e mesmo próximo vencimento de `reversed`: desempate pelo id.
  { label: "sameCreated", party: "A", status: "OPEN", parcels: [{ amount: 10, due: 10 }], createdAt: at(9) },
  {
    label: "multi",
    party: "B",
    status: "OPEN",
    parcels: [
      // Mesmo vencimento: a numeração desempata pelo id da parcela.
      { amount: 15, due: 40 },
      { amount: 16, due: 40 },
      { amount: 15, due: 70 },
    ],
    createdAt: at(11),
  },
  { label: "unknownParty", party: "unknown", status: "OPEN", parcels: [{ amount: 12.34, due: 2 }], createdAt: at(12), only: "RECEIVABLE" },
  {
    label: "withPurchase",
    party: "A",
    status: "OPEN",
    parcels: [{ amount: 45.67, due: -7 }],
    createdAt: at(13),
    withPurchase: true,
    only: "PAYABLE",
  },
  // Persistido PAID, mas o pagamento foi estornado (inconsistente): exibe PAID, conta no a vencer.
  {
    label: "paidInconsistent",
    party: "A",
    status: "PAID",
    parcels: [{ amount: 20, due: 6, payments: [{ amount: 20, reversed: true }] }],
    createdAt: at(14),
  },
  { label: "noParcels", party: "B", status: "OPEN", parcels: [], createdAt: at(15) },
  {
    label: "cents",
    party: "A",
    status: "PARTIALLY_PAID",
    parcels: [
      { amount: 0.3, due: -4, payments: [{ amount: 0.1 }, { amount: 0.2 }] },
      { amount: 1, due: 8, payments: [{ amount: 0.01 }] },
    ],
    createdAt: at(16),
  },
  // Igual a `openToday` no vencimento e posterior no createdAt.
  { label: "openToday2", party: "A", status: "OPEN", parcels: [{ amount: 5, due: 0 }], createdAt: at(17) },
];

const STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELED"] as const;

interface ListCase {
  name: string;
  party?: "A" | "B";
  filters: Omit<FinancialListFilters, "partyId">;
  page?: number;
  limit?: number;
}
interface ExportCase {
  name: string;
  party?: "A" | "B";
  filters: Omit<FinancialListFilters, "partyId">;
  maxRows?: number;
}

const LIST_CASES: ListCase[] = [
  { name: "scope", filters: SCOPE },
  ...STATUSES.map((status) => ({ name: `scope status=${status}`, filters: { ...SCOPE, status } })),
  { name: "scope openOnly", filters: { ...SCOPE, openOnly: true } },
  { name: "scope openOnly=false", filters: { ...SCOPE, openOnly: false } },
  ...STATUSES.map((status) => ({ name: `scope openOnly status=${status}`, filters: { ...SCOPE, openOnly: true, status } })),
  { name: "party A", party: "A", filters: {} },
  { name: "party B", party: "B", filters: {} },
  { name: "party A openOnly", party: "A", filters: { openOnly: true } },
  { name: "party B status=OVERDUE", party: "B", filters: { status: "OVERDUE" } },
  { name: "party B status=OPEN", party: "B", filters: { status: "OPEN" } },
  { name: "narrow range", filters: { dueFrom: addDays(-3), dueTo: addDays(5) } },
  { name: "narrow range openOnly", filters: { dueFrom: addDays(-3), dueTo: addDays(5), openOnly: true } },
  { name: "due today", filters: { dueFrom: TODAY, dueTo: TODAY } },
  { name: "due today openOnly", filters: { dueFrom: TODAY, dueTo: TODAY, openOnly: true } },
  { name: "party A dueTo yesterday", party: "A", filters: { dueTo: addDays(-1) } },
  { name: "party A dueTo yesterday openOnly", party: "A", filters: { dueTo: addDays(-1), openOnly: true } },
  { name: "party B dueFrom today", party: "B", filters: { dueFrom: TODAY } },
  { name: "party B dueFrom today openOnly", party: "B", filters: { dueFrom: TODAY, openOnly: true } },
  { name: "scope page 1/limit 3", filters: SCOPE, page: 1, limit: 3 },
  { name: "scope page 2/limit 3", filters: SCOPE, page: 2, limit: 3 },
  { name: "scope page 5/limit 3", filters: SCOPE, page: 5, limit: 3 },
  { name: "scope page 9/limit 3 (além do fim)", filters: SCOPE, page: 9, limit: 3 },
  { name: "scope openOnly page 2/limit 4", filters: { ...SCOPE, openOnly: true }, page: 2, limit: 4 },
  { name: "empty range", filters: { dueFrom: "2096-12-01", dueTo: "2096-12-31" } },
];

const EXPORT_CASES: ExportCase[] = [
  { name: "scope", filters: SCOPE },
  { name: "scope openOnly", filters: { ...SCOPE, openOnly: true } },
  ...STATUSES.map((status) => ({ name: `scope status=${status}`, filters: { ...SCOPE, status } })),
  { name: "party A", party: "A", filters: {} },
  { name: "party B", party: "B", filters: {} },
  { name: "party B openOnly", party: "B", filters: { openOnly: true } },
  { name: "narrow range", filters: { dueFrom: addDays(-3), dueTo: addDays(5) } },
  { name: "narrow range openOnly", filters: { dueFrom: addDays(-3), dueTo: addDays(5), openOnly: true } },
  { name: "party A dueTo yesterday", party: "A", filters: { dueTo: addDays(-1) } },
  { name: "party B dueFrom today openOnly", party: "B", filters: { dueFrom: TODAY, openOnly: true } },
  { name: "party A maxRows=8", party: "A", filters: {}, maxRows: 8 },
  { name: "party A maxRows=100", party: "A", filters: {}, maxRows: 100 },
];

describe("Contas a receber/pagar: lista, resumo e exportação equivalentes ao cálculo em memória", () => {
  const repo = new PrismaFinancialDocumentReadRepository();
  /** uuid (ou código) → rótulo estável para o snapshot. */
  const labels = new Map<string, string>();
  const parties: Record<Kind, Record<"A" | "B", string>> = { RECEIVABLE: {} as never, PAYABLE: {} as never };
  const docIds: string[] = [];
  const customerIds: string[] = [];
  const supplierIds: string[] = [];
  const purchaseIds: string[] = [];

  // Ids em ordem DECRESCENTE de criação: empates (mesmo createdAt, mesmo vencimento) são
  // desempatados pelo id, então o resultado é determinístico e o documento/parcela criado
  // depois vem antes — distingue o desempate por id de um desempate por ordem de criação.
  const idPool = Array.from({ length: 200 }, () => randomUUID()).sort().reverse();
  const nextId = () => idPool.shift()!;

  const normalize = (value: unknown): unknown => {
    let json = JSON.stringify(value);
    for (const [raw, label] of labels) json = json.split(raw).join(label);
    return JSON.parse(json);
  };

  before(async () => {
    const userId = await getTestUserId();
    for (const p of ["A", "B"] as const) {
      const tag = `tx-eq-${randomUUID()}`;
      const c = await prisma.customer.create({ data: { name: `tx-eq Cliente ${p}`, code: tag } });
      const s = await prisma.supplier.create({ data: { name: `tx-eq Fornecedor ${p}`, document: randomCpf() } });
      customerIds.push(c.id);
      supplierIds.push(s.id);
      parties.RECEIVABLE[p] = c.id;
      parties.PAYABLE[p] = s.id;
      labels.set(c.id, `customer:${p}`).set(tag, `customerCode:${p}`).set(s.id, `supplier:${p}`);
    }

    for (const type of ["RECEIVABLE", "PAYABLE"] as const) {
      for (const seed of SEEDS) {
        if (seed.only && seed.only !== type) continue;
        const partyId = seed.party === "unknown" ? randomUUID() : parties[type][seed.party];
        if (seed.party === "unknown") labels.set(partyId, `party:unknown:${type}`);
        let originId: string = randomUUID();
        if (seed.withPurchase) {
          const code = `tx-eq-${randomUUID()}`;
          const purchase = await prisma.purchase.create({
            data: {
              code,
              supplierId: partyId,
              status: "PENDING",
              origin: "MANUAL",
              purchaseDate: asDate(TODAY),
              totalAmount: 45.67,
            },
          });
          purchaseIds.push(purchase.id);
          originId = purchase.id;
          labels.set(code, `purchaseCode:${seed.label}`);
        }
        labels.set(originId, `origin:${type}:${seed.label}`);
        const doc = await prisma.financialDocument.create({
          data: {
            id: nextId(),
            type,
            originType: type === "RECEIVABLE" ? "SALE" : "PURCHASE",
            originId,
            partyId,
            partyType: type === "RECEIVABLE" ? "CUSTOMER" : "SUPPLIER",
            status: seed.status,
            createdAt: seed.createdAt,
          },
        });
        docIds.push(doc.id);
        labels.set(doc.id, `doc:${type}:${seed.label}`);
        for (const [i, p] of seed.parcels.entries()) {
          const parcel = await prisma.financialParcel.create({
            data: {
              id: nextId(),
              financialDocumentId: doc.id,
              amount: p.amount,
              dueDate: asDate(addDays(p.due)),
              payments: {
                create: (p.payments ?? []).map((pay) => ({
                  amount: pay.amount,
                  method: "PIX" as const,
                  paymentDate: asDate(TODAY),
                  createdById: userId,
                  ...(pay.reversed ? { reversedAt: new Date(), reversedById: userId, reversalReason: "tx-eq estorno" } : {}),
                })),
              },
            },
          });
          labels.set(parcel.id, `parcel:${type}:${seed.label}:${i + 1}`);
        }
      }
    }
  });

  after(async () => {
    try {
      await prisma.financialDocument.deleteMany({ where: { id: { in: docIds } } });
      await prisma.purchase.deleteMany({ where: { id: { in: purchaseIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
      await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  const runAll = async () => {
    const out: Record<string, unknown> = {};
    for (const type of ["RECEIVABLE", "PAYABLE"] as const) {
      const t = type as FinancialType;
      for (const c of LIST_CASES) {
        const filters = { ...c.filters, ...(c.party ? { partyId: parties[type][c.party] } : {}) };
        out[`${type} list: ${c.name}`] = await repo.list(t, filters, { page: c.page ?? 1, limit: c.limit ?? 100 }, TODAY);
      }
      for (const c of EXPORT_CASES) {
        const filters = { ...c.filters, ...(c.party ? { partyId: parties[type][c.party] } : {}) };
        try {
          out[`${type} export: ${c.name}`] = await repo.listParcelsForExport(t, filters, TODAY, c.maxRows ?? 50_000);
        } catch (err) {
          out[`${type} export: ${c.name}`] = { error: (err as Error).name, code: (err as { code?: string }).code };
        }
      }
    }
    return normalize(out) as Record<string, unknown>;
  };

  test("cada combinação de filtros devolve exatamente o snapshot da implementação anterior", async () => {
    const actual = await runAll();
    if (process.env.UPDATE_FINANCE_SNAPSHOT === "1") {
      writeFileSync(SNAPSHOT, `${JSON.stringify(actual, null, 2)}\n`);
    }
    assert.ok(existsSync(SNAPSHOT), "snapshot ausente");
    const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Record<string, unknown>;
    assert.deepEqual(Object.keys(actual), Object.keys(expected));
    for (const key of Object.keys(expected)) {
      assert.deepEqual(actual[key], expected[key], key);
      // Mesma ordem de chaves: a resposta HTTP serializada é idêntica.
      assert.equal(JSON.stringify(actual[key]), JSON.stringify(expected[key]), key);
    }
  });

  test("exportação acima do teto falha sem carregar tudo: o SQL busca no máximo maxRows + 1 linhas", async () => {
    const calls: { values: unknown[]; rows: number }[] = [];
    let otherCalls = 0;
    const spy = new Proxy(prisma, {
      get(target, key) {
        if (key === "$queryRaw") {
          return async (...args: unknown[]) => {
            const query = args[0] as { values?: unknown[] };
            const rows = (await (target.$queryRaw as (...a: unknown[]) => Promise<unknown[]>)(...args)) as unknown[];
            calls.push({ values: query.values ?? [], rows: rows.length });
            return rows;
          };
        }
        if (key === "customer" || key === "supplier" || key === "purchase" || key === "financialDocument") {
          otherCalls++;
        }
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    // Party A (a receber) tem 11 parcelas no total; teto 3.
    await assert.rejects(
      runInTransactionContext(spy as never, () =>
        repo.listParcelsForExport(FinancialType.RECEIVABLE, { partyId: parties.RECEIVABLE.A }, TODAY, 3),
      ),
      (err: Error & { code?: string }) => err.name === "ExportTooLargeError" || err.code === "EXPORT_TOO_LARGE",
    );
    assert.equal(calls.length, 1, "uma única consulta SQL");
    assert.ok(calls[0].values.includes(4), "LIMIT maxRows + 1 parametrizado");
    assert.equal(calls[0].rows, 4, "no máximo maxRows + 1 linhas carregadas");
    assert.equal(otherCalls, 0, "não busca contrapartes nem documentos quando estoura o teto");
  });
});
