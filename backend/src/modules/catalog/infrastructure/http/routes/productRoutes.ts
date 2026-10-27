import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateProductController } from "../controllers/CreateProductController";
import { makeListProductsController } from "../controllers/ListProductsController";
import { makeCreateVariantController } from "../controllers/CreateVariantController";
import { makeGetProductController } from "../controllers/GetProductController";
import { makeListProductVariantsController } from "../controllers/ListProductVariantsController";
import { makeUpdateProductController } from "../controllers/UpdateProductController";
import { makeDeleteProductController } from "../controllers/DeleteProductController";

export async function productRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authorize("catalog.write")] },
    makeCreateProductController(),
  );
  app.get(
    "/",
    { preHandler: [authorize("catalog.read")] },
    makeListProductsController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize("catalog.read")] },
    makeGetProductController(),
  );
  app.put(
    "/:id",
    { preHandler: [authorize("catalog.write")] },
    makeUpdateProductController(),
  );
  app.delete(
    "/:id",
    { preHandler: [authorize("catalog.delete")] },
    makeDeleteProductController(),
  );
  app.post(
    "/:productId/variants",
    { preHandler: [authorize("catalog.write")] },
    makeCreateVariantController(),
  );
  app.get(
    "/:productId/variants",
    { preHandler: [authorize("catalog.read")] },
    makeListProductVariantsController(),
  );
}
