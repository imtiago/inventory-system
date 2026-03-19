import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { PrismaProductRepository } from "../../repositories/PrismaProductRepository";
import { makeCreateProductController } from "../controllers/CreateProductController";
import { makeListProductsController } from "../controllers/ListProductsController";
import { makeCreateVariantController } from "../controllers/CreateVariantController";
import { makeGetProductController } from "../controllers/GetProductController";
import { makeListProductVariantsController } from "../controllers/ListProductVariantsController";
import { makeUpdateProductController } from "../controllers/UpdateProductController";
import { makeDeleteProductController } from "../controllers/DeleteProductController";

export async function productRoutes(app: FastifyInstance) {
  const productRepo = new PrismaProductRepository();

  app.post(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateProductController(productRepo),
  );
  app.get(
    "/",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListProductsController(productRepo),
  );
  app.get(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeGetProductController(productRepo),
  );
  app.put(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeUpdateProductController(productRepo),
  );
  app.delete(
    "/:id",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeDeleteProductController(productRepo),
  );
  app.post(
    "/:productId/variants",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeCreateVariantController(productRepo),
  );
  app.get(
    "/:productId/variants",
    { preHandler: [authorize(["admin", "vendedor"])] },
    makeListProductVariantsController(productRepo),
  );
}
