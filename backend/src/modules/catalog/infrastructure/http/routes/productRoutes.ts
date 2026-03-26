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
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateProductController(),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListProductsController(),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetProductController(),
  );
  app.put(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeUpdateProductController(),
  );
  app.delete(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeDeleteProductController(),
  );
  app.post(
    "/:productId/variants",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateVariantController(),
  );
  app.get(
    "/:productId/variants",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListProductVariantsController(),
  );
}
