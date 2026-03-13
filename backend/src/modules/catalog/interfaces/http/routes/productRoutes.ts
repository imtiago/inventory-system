import { FastifyInstance } from "fastify";
import { CreateProductController } from "../controllers/CreateProductController";
import { ListProductsController } from "../controllers/ListProductsController";

export async function productRoutes(app: FastifyInstance) {
  app.post("/products", CreateProductController);
  app.get("/products", ListProductsController);
}
