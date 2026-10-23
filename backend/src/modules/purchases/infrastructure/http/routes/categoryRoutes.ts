// src/modules/catalog/infrastructure/http/routes/categoryRoutes.ts
import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCategoryController } from "../controllers/CreateCategoryController";
import { makeListCategoriesController } from "../controllers/ListCategoriesController";

export async function categoryRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("catalog.write")] },
    makeCreateCategoryController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("catalog.read")] },
    makeListCategoriesController(),
  );
}
