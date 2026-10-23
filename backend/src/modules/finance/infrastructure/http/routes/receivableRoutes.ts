import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { makeListReceivablesController } from "../controllers/ListReceivablesController";
import { makeGetReceivableController } from "../controllers/GetReceivableController";
import { makeRegisterPaymentController } from "../controllers/RegisterPaymentController";
import { makeReversePaymentController } from "../controllers/ReversePaymentController";

export async function receivableRoutes(app: FastifyInstance) {
  // Contas a receber são criadas pelos fluxos de origem (ex.: venda), não por rota própria.
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListReceivablesController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetReceivableController(),
  );
  app.post(
    "/:id/parcels/:parcelId/payments",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeRegisterPaymentController(),
  );
  app.post(
    "/payments/:paymentId/reverse",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeReversePaymentController(),
  );
}
