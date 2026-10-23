import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { idempotent } from "@shared/http/idempotency/idempotent";
import { Permission } from "@shared/auth/permissions";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { makeListFinancialDocumentsController } from "../controllers/ListFinancialDocumentsController";
import { makeGetFinancialDocumentController } from "../controllers/GetFinancialDocumentController";
import { makeRegisterPaymentController } from "../controllers/RegisterPaymentController";
import { makeReversePaymentController } from "../controllers/ReversePaymentController";

interface FinancialRoutesOptions {
  type: FinancialType;
  permissions: { read: Permission; pay: Permission; reverse: Permission };
}

/**
 * Rotas de um tipo de documento financeiro (/receivables ou /payables): mesmas
 * regras, travas e códigos de erro; cada família só enxerga o seu tipo.
 * Os documentos são criados pelos fluxos de origem (venda, pedido de compra).
 */
function financialDocumentRoutes({ type, permissions }: FinancialRoutesOptions) {
  return async function routes(app: FastifyInstance) {
    app.get("/", { preHandler: [authorize(permissions.read)] }, makeListFinancialDocumentsController(type));
    app.get("/:id", { preHandler: [authorize(permissions.read)] }, makeGetFinancialDocumentController(type));
    app.post(
      "/:id/parcels/:parcelId/payments",
      { preHandler: [authorize(permissions.pay)] },
      idempotent(makeRegisterPaymentController(type)),
    );
    app.post(
      "/payments/:paymentId/reverse",
      { preHandler: [authorize(permissions.reverse)] },
      idempotent(makeReversePaymentController(type)),
    );
  };
}

export const receivableRoutes = financialDocumentRoutes({
  type: FinancialType.RECEIVABLE,
  permissions: { read: "finance.read", pay: "finance.pay", reverse: "finance.reverse" },
});

export const payableRoutes = financialDocumentRoutes({
  type: FinancialType.PAYABLE,
  permissions: { read: "payables.read", pay: "payables.pay", reverse: "payables.reverse" },
});
