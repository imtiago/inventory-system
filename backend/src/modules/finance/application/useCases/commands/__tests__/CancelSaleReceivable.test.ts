import { test } from "node:test";
import assert from "node:assert/strict";
import { CancelSaleReceivableUseCase } from "../CancelSaleReceivableUseCase";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { InMemoryTransactionManager } from "@shared/application/transaction/InMemoryTransactionManager";

const newDoc = () =>
  new FinancialDocument({
    type: FinancialType.RECEIVABLE,
    originId: "sale-1",
    originType: FinancialOriginType.SALE,
    partyId: "c-1",
    partyType: FinancialPartyType.CUSTOMER,
  });

function build(docs: FinancialDocument[], withPayments: string[] = []) {
  const log: string[] = [];
  const updated: FinancialDocument[] = [];
  const repo: FinancialDocumentRepository = {
    create: async (d) => d,
    lockByOrigin: async (type, originType, originId) => {
      log.push(`lock:${type}:${originType}:${originId}`);
      return docs;
    },
    hasPayments: async (ids) => {
      log.push(`hasPayments:${ids.join(",")}`);
      return ids.some((id) => withPayments.includes(id));
    },
    update: async (d) => {
      log.push(`update:${d.id}`);
      updated.push(d);
      return d;
    },
  };
  const uc = new CancelSaleReceivableUseCase(repo, new InMemoryTransactionManager());
  return { uc, log, updated };
}

test("trava os documentos da venda antes de checar pagamentos e cancela todos", async () => {
  const a = newDoc();
  const b = newDoc();
  const { uc, log, updated } = build([a, b]);
  await uc.execute({ saleId: "sale-1" });
  assert.deepEqual(log, [
    "lock:RECEIVABLE:SALE:sale-1",
    `hasPayments:${a.id},${b.id}`,
    `update:${a.id}`,
    `update:${b.id}`,
  ]);
  assert.deepEqual(updated.map((d) => d.status), [FinancialStatus.CANCELED, FinancialStatus.CANCELED]);
});

test("pagamento em qualquer documento → 409 SALE_HAS_PAYMENTS; nenhum atualizado", async () => {
  const a = newDoc();
  const b = newDoc();
  const { uc, updated } = build([a, b], [b.id]);
  await assert.rejects(() => uc.execute({ saleId: "sale-1" }), {
    name: "ConflictError",
    code: "SALE_HAS_PAYMENTS",
    message: "Venda com pagamentos registrados não pode ser cancelada.",
  });
  assert.equal(updated.length, 0);
});

test("venda sem documento: nada a fazer", async () => {
  const { uc, log } = build([]);
  await uc.execute({ saleId: "sale-1" });
  assert.deepEqual(log, ["lock:RECEIVABLE:SALE:sale-1"]);
});
