import { FastifyInstance } from "fastify";
import { makeCreateSaleController } from "../controllers/CreateSaleController";
import { makeListSalesController } from "../controllers/ListSalesController";
import { makeGetSaleController } from "../controllers/GetSaleController";
import { makeCancelSaleController } from "../controllers/CancelSaleController";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function saleRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("sales.create")] },
    makeCreateSaleController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize("sales.read")] },
    makeGetSaleController(),
  );
  app.post(
    "/:id/cancel",
    { preHandler: [authorize("sales.cancel")] },
    makeCancelSaleController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("sales.read")] },
    makeListSalesController(),
  );
}
