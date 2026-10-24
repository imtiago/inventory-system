import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import {
  makeFinanceReportController,
  makeSaleItemsReportController,
  makeSalesReportController,
  makeStockReportController,
} from "../controllers/reportControllers";

/** Exportações CSV (somente leitura); mesma permissão da lista correspondente. */
export async function reportRoutes(app: FastifyInstance) {
  app.get("/sales.csv", { preHandler: [authorize("sales.read")] }, makeSalesReportController());
  app.get("/sale-items.csv", { preHandler: [authorize("sales.read")] }, makeSaleItemsReportController());
  app.get("/stock.csv", { preHandler: [authorize("inventory.read")] }, makeStockReportController());
  app.get(
    "/receivables.csv",
    { preHandler: [authorize("finance.read")] },
    makeFinanceReportController(FinancialType.RECEIVABLE),
  );
  app.get(
    "/payables.csv",
    { preHandler: [authorize("payables.read")] },
    makeFinanceReportController(FinancialType.PAYABLE),
  );
}
