import { FastifyInstance } from "fastify";
import { authorize } from "@shared/middleware/authorize";
import {
  makeCreateSupplierController,
  makeDeleteSupplierController,
  makeGetSupplierController,
  makeListSuppliersController,
  makeUpdateSupplierController,
} from "../controllers/supplierControllers";

export async function supplierRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authorize("purchases.read")] }, makeListSuppliersController());
  app.get("/:id", { preHandler: [authorize("purchases.read")] }, makeGetSupplierController());
  app.post("/", { preHandler: [authorize("purchases.write")] }, makeCreateSupplierController());
  app.patch("/:id", { preHandler: [authorize("purchases.write")] }, makeUpdateSupplierController());
  app.delete("/:id", { preHandler: [authorize("purchases.write")] }, makeDeleteSupplierController());
}
