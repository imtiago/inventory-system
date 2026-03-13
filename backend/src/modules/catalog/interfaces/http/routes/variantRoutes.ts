import { FastifyInstance } from "fastify";
import { CreateVariantController } from "../controllers/CreateVariantController";

export async function variantRoutes(app: FastifyInstance) {
  app.post("/variants", CreateVariantController);
}
