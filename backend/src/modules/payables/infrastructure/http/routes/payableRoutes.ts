// src/modules/payables/infrastructure/http/routes/payableRoutes.ts
import { PrismaPayableRepository } from "@payables/infrastructure/repositories/PrismaPayableRepository";
import { authorize } from "@shared/middleware/authorize";
import { FastifyInstance } from "fastify";
import { makeCreatePayableController } from "../controllers/CreatePayableController";
import { makeListPayablesController } from "../controllers/ListPayablesController";
import { makeMarkParcelPaidController } from "../controllers/MarkParcelPaidController";

export async function payableRoutes(app: FastifyInstance) {
  const repo = new PrismaPayableRepository();

  app.post(
    "/payables",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreatePayableController(repo),
  );

  app.get(
    "/payables",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListPayablesController(repo),
  );

  app.patch(
    "/parcels/:parcelId/pay",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeMarkParcelPaidController(repo),
  );
}
