// src/modules/catalog/infrastructure/http/routes/brandRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateBrandController } from "../controllers/CreateBrandController";
import { makeListBrandsController } from "../controllers/ListBrandsController";

export async function brandRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("catalog.write")] },
    makeCreateBrandController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("catalog.read")] },
    makeListBrandsController(),
  );
}
