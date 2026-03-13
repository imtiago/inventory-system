import { FastifyInstance } from "fastify";
import { CreateSaleController } from "../controllers/CreateSaleController";
import { ListSalesController } from "../controllers/ListSalesController";
import { GetSaleController } from "../controllers/GetSaleController";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function saleRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    CreateSaleController,
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    ListSalesController,
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    GetSaleController,
  );
}
