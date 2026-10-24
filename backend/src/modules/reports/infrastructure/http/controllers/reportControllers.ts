import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { dateOnly } from "@finance/interfaces/http/schemas/financialDocumentQuerySchemas";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeExportFinancialParcelsUseCase } from "@finance/infrastructure/http/factories/FinancialDocumentReadFactory";
import { parseListQuery } from "@finance/infrastructure/http/controllers/ListFinancialDocumentsController";
import {
  csvDate,
  csvHeaders,
  csvMoney,
  csvQty,
  CsvCell,
  toCsv,
} from "@shared/http/csv";
import { PrismaReportReadRepository } from "../../prisma/PrismaReportReadRepository";

const DEFAULT_MAX_ROWS = 50_000;
const MAX_PERIOD_DAYS = 366;

/** Limite de linhas por exportação; `REPORT_MAX_ROWS` permite reduzi-lo (testes). */
export function maxExportRows(): number {
  const n = Number(process.env.REPORT_MAX_ROWS);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_ROWS;
}

const SALE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};
const PARCEL_STATUS_LABEL: Record<string, string> = {
  OPEN: "Em aberto",
  PARTIALLY_PAID: "Parcialmente paga",
  PAID: "Paga",
  OVERDUE: "Vencida",
  CANCELED: "Cancelada",
};

const periodShape = { from: dateOnly("Data inicial"), to: dateOnly("Data final") };
const dayMs = 86_400_000;
const validPeriod = (q: { from: string; to: string }) => q.from <= q.to;
const periodError = { message: "A data inicial deve ser anterior ou igual à final.", path: ["to"] };
const spanOk = (q: { from: string; to: string }) =>
  (Date.parse(q.to) - Date.parse(q.from)) / dayMs + 1 <= MAX_PERIOD_DAYS;
const spanError = { message: `O período deve ter no máximo ${MAX_PERIOD_DAYS} dias.`, path: ["to"] };

const salesQuerySchema = z
  .object({ ...periodShape, status: z.enum(["PENDING", "COMPLETED", "CANCELED"], { message: "Status inválido." }).optional() })
  .refine(validPeriod, periodError)
  .refine(spanOk, spanError);
const saleItemsQuerySchema = z.object(periodShape).refine(validPeriod, periodError).refine(spanOk, spanError);

function send(reply: FastifyReply, name: string, headers: string[], rows: CsvCell[][]) {
  return reply.status(200).headers(csvHeaders(name, todayInBusinessTz())).send(toCsv(headers, rows));
}

const repo = () => new PrismaReportReadRepository();

export function makeSalesReportController() {
  return async function SalesReportController(req: FastifyRequest, reply: FastifyReply) {
    const q = parseInput(salesQuerySchema, req.query);
    const sales = await repo().sales(q.from, q.to, q.status ?? null, maxExportRows());
    return send(
      reply,
      "vendas",
      ["Venda", "Data", "Cliente", "Status", "Itens", "Total"],
      sales.map((s) => [s.id, csvDate(s.day), s.customerName, SALE_STATUS_LABEL[s.status] ?? s.status, s.itemsCount, csvMoney(s.total)]),
    );
  };
}

export function makeSaleItemsReportController() {
  return async function SaleItemsReportController(req: FastifyRequest, reply: FastifyReply) {
    const q = parseInput(saleItemsQuerySchema, req.query);
    const items = await repo().saleItems(q.from, q.to, maxExportRows());
    return send(
      reply,
      "itens-vendidos",
      ["Venda", "Data", "Cliente", "Produto", "Variante", "Código", "Quantidade", "Preço unitário", "Total"],
      items.map((i) => [
        i.saleId, csvDate(i.day), i.customerName, i.productName, i.variantName, i.code,
        csvQty(i.quantity), csvMoney(i.unitPrice), csvMoney(i.total),
      ]),
    );
  };
}

export function makeStockReportController() {
  return async function StockReportController(_req: FastifyRequest, reply: FastifyReply) {
    const rows = await repo().stock(maxExportRows());
    return send(
      reply,
      "estoque",
      ["Produto", "Variante", "Código", "Código de barras", "Quantidade", "Reservado", "Disponível", "Custo médio", "Valor em estoque"],
      rows.map((r) => [
        r.productName, r.variantName, r.code, r.barcode,
        csvQty(r.quantity), csvQty(r.reserved), csvQty(r.quantity - r.reserved),
        csvMoney(r.averageCost), csvMoney(r.stockValue),
      ]),
    );
  };
}

/** Contas a receber/pagar: mesmos filtros e mesma leitura da lista, uma linha por parcela. */
export function makeFinanceReportController(type: FinancialType) {
  const useCase = makeExportFinancialParcelsUseCase(type);
  const receivable = type === FinancialType.RECEIVABLE;
  return async function FinanceReportController(req: FastifyRequest, reply: FastifyReply) {
    const { filters } = parseListQuery(type, req.query);
    const parcels = await useCase.execute(filters, maxExportRows());
    return send(
      reply,
      receivable ? "contas-a-receber" : "contas-a-pagar",
      ["Documento", receivable ? "Cliente" : "Fornecedor", receivable ? "Origem" : "Pedido", "Parcela", "Vencimento", "Valor", "Pago", "Saldo", "Status"],
      parcels.map((p) => [
        p.documentId,
        p.partyName,
        receivable ? (p.originType === "SALE" ? `Venda ${p.originId}` : p.originType) : (p.purchaseCode ?? ""),
        p.number,
        csvDate(p.dueDate),
        csvMoney(p.amount.toFixed(2)),
        csvMoney(p.paidAmount.toFixed(2)),
        csvMoney(p.remainingAmount.toFixed(2)),
        PARCEL_STATUS_LABEL[p.status] ?? p.status,
      ]),
    );
  };
}
