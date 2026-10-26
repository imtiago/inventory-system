import { authorize } from "@shared/middleware/authorize";
import { FastifyInstance } from "fastify";
import { makeListStockMovementsController } from "../controllers/ListStockMovementsController";

export async function stockMovementRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authorize("inventory.read")] },
    makeListStockMovementsController(),
  );
}
