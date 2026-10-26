import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { idempotent } from "@shared/http/idempotency/idempotent";
import { makeCreateInventoryLotController } from "../controllers/CreateInventoryLotController";

export async function inventoryLotRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("inventory.write")] },
    idempotent(makeCreateInventoryLotController()),
  );
}
