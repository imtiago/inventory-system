import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateCategoryController } from "../controllers/CreateCategoryController";
import { makeListCategoriesController } from "../controllers/ListCategoriesController";
import { makeGetCategoryController } from "../controllers/GetCategoryController";
import { makeUpdateCategoryController } from "../controllers/UpdateCategoryController";
import { makeDeleteCategoryController } from "../controllers/DeleteCategoryController";

export async function categoryRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [authorize("catalog.write")] }, makeCreateCategoryController());
  app.get("/", { preHandler: [authorize("catalog.read")] }, makeListCategoriesController());
  app.get("/:id", { preHandler: [authorize("catalog.read")] }, makeGetCategoryController());
  app.put("/:id", { preHandler: [authorize("catalog.write")] }, makeUpdateCategoryController());
  app.delete("/:id", { preHandler: [authorize("catalog.delete")] }, makeDeleteCategoryController());
}
