import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import {
  periodError,
  periodShape,
  salesPeriodQuerySchema as salesQuerySchema,
  spanError,
  spanOk,
  validPeriod,
} from "@sales/interfaces/http/schemas/salePeriodSchema";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeExportFinancialParcelsUseCase } from "@finance/infrastructure/http/factories/FinancialDocumentReadFactory";
import { parseListQuery } from "@finance/infrastructure/http/controllers/ListFinancialDocumentsController";
import {
  csvCents,
  csvDate,
  csvHeaders,
  csvMoney,
  csvQty,
  CsvCell,
  toCsv,
} from "@shared/http/csv";
import { PrismaReportReadRepository } from "../../prisma/PrismaReportReadRepository";
import { PrismaProfitReportRepository } from "../../prisma/PrismaProfitReportRepository";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { buildProfit } from "../../../application/profit";
import { profitReportQuerySchema, ProfitView } from "../../../interfaces/http/schemas/profitReportSchema";

const DEFAULT_MAX_ROWS = 50_000;

/** Limite de linhas por exportação; `REPORT_MAX_ROWS` permite apenas reduzi-lo (testes). */
export function maxExportRows(): number {
  const n = Number(process.env.REPORT_MAX_ROWS);
  return Number.isInteger(n) && n > 0 ? Math.min(n, DEFAULT_MAX_ROWS) : DEFAULT_MAX_ROWS;
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

const ORIGIN_LABEL: Record<string, string> = { MANUAL: "Manual", INVOICE: "Nota fiscal", PURCHASE: "Compra" };
const originLabel = (type: string, id: string) => (type === "SALE" ? `Venda ${id}` : (ORIGIN_LABEL[type] ?? type));

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
        receivable ? originLabel(p.originType, p.originId) : (p.purchaseCode ?? ""),
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

/** Lê o relatório de lucro (linhas + totais) com as despesas estimadas atuais. */
async function loadProfit(query: unknown, limit: number) {
  const q = parseInput(profitReportQuerySchema, query);
  const rows = await new PrismaProfitReportRepository().aggregate(q.from, q.to, q.view, q.sellerId ?? null, limit);
  const { expensesBps } = await new PrismaPricingSettingsReader().getMarginSettings();
  return { view: q.view, ...buildProfit(rows, expensesBps) };
}

export function makeProfitReportController() {
  return async function ProfitReportController(req: FastifyRequest, reply: FastifyReply) {
    const { rows, totals } = await loadProfit(req.query, maxExportRows());
    return reply.status(200).send({ data: { rows, totals } });
  };
}

const PROFIT_VIEW_HEADER: Record<ProfitView, string> = {
  period: "Dia",
  sale: "Venda",
  variant: "Produto",
  category: "Categoria",
};

export function makeProfitCsvController() {
  return async function ProfitCsvController(req: FastifyRequest, reply: FastifyReply) {
    const { view, rows, totals } = await loadProfit(req.query, maxExportRows());
    const line = (r: (typeof rows)[number]): CsvCell[] => [
      r.label,
      csvCents(Math.round(r.revenue * 100)),
      csvCents(Math.round(r.cost * 100)),
      csvCents(Math.round(r.estimatedExpenses * 100)),
      csvCents(Math.round(r.profit * 100)),
      r.marginPercent === null ? "" : csvQty(r.marginPercent.toFixed(2)),
      r.itemsWithoutCost,
    ];
    return send(
      reply,
      "lucro",
      [PROFIT_VIEW_HEADER[view], "Receita", "Custo", "Despesas estimadas", "Lucro", "Margem (%)", "Custo não registrado"],
      [...rows.map(line), line(totals)],
    );
  };
}
