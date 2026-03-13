// src/modules/receivables/infrastructure/http/routes/receivableRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import { PrismaReceivableRepository } from "@receivables/infrastructure/repositories/PrismaReceivableRepository";
import { makeCreateReceivableController } from "../controllers/CreateReceivableController";
import { makeListReceivablesController } from "../controllers/ListReceivablesController";
import { makeMarkParcelPaidController } from "../controllers/MarkParcelPaidController";

export async function receivableRoutes(app: FastifyInstance) {
  const repo = new PrismaReceivableRepository();

  app.post(
    "/receivables",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateReceivableController(repo),
  );

  app.get(
    "/receivables",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListReceivablesController(repo),
  );

  app.patch(
    "/receivables/parcels/:parcelId/pay",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeMarkParcelPaidController(repo),
  );
}
