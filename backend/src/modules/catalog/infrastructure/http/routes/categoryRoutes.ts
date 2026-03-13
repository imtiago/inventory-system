// src/modules/catalog/infrastructure/http/routes/categoryRoutes.ts
import { FastifyInstance } from "fastify";
import { PrismaCategoryRepository } from "../../repositories/PrismaCategoryRepository";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCategoryController } from "../controllers/CreateCategoryController";
import { makeListCategoriesController } from "../controllers/ListCategoriesController";

export async function categoryRoutes(app: FastifyInstance) {
  const categoryRepo = new PrismaCategoryRepository();

  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateCategoryController(categoryRepo),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListCategoriesController(categoryRepo),
  );
}
