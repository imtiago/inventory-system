// src/modules/catalog/infrastructure/http/routes/brandRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateBrandController } from "../controllers/CreateBrandController";
import { makeListBrandsController } from "../controllers/ListBrandsController";
import { PrismaBrandRepository } from "../../repositories/PrismaBrandRepository";

export async function brandRoutes(app: FastifyInstance) {
  const brandRepo = new PrismaBrandRepository();

  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateBrandController(brandRepo),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListBrandsController(brandRepo),
  );
}
