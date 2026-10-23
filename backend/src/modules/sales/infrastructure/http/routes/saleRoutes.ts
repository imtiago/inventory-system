import { FastifyInstance } from "fastify";
import { makeCreateSaleController } from "../controllers/CreateSaleController";
import { makeListSalesController } from "../controllers/ListSalesController";
import { makeGetSaleController } from "../controllers/GetSaleController";
import { makeCancelSaleController } from "../controllers/CancelSaleController";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function saleRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateSaleController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetSaleController(),
  );
  app.post(
    "/:id/cancel",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCancelSaleController(),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListSalesController(),
  );
}
