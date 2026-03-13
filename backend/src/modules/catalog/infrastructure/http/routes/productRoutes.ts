import { FastifyInstance } from "fastify";
import { CreateProductController } from "../controllers/CreateProductController";
import { ListProductsController } from "../controllers/ListProductsController";
import { GetProductController } from "../controllers/GetProductController";
import { CreateVariantController } from "../controllers/CreateVariantController";
import { ListProductVariantsController } from "../controllers/ListProductVariantsController";

export async function productRoutes(app: FastifyInstance) {
  app.post("/", CreateProductController);
  app.get("/", ListProductsController);
  app.get("/:id", GetProductController);
  app.post("/:productId/variants", CreateVariantController);
  app.get("/:productId/variants", ListProductVariantsController);
}
