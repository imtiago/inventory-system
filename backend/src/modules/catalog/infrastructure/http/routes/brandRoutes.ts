import { FastifyInstance } from "fastify";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateBrandController } from "../controllers/CreateBrandController";
import { makeListBrandsController } from "../controllers/ListBrandsController";
import { makeGetBrandController } from "../controllers/GetBrandController";
import { makeUpdateBrandController } from "../controllers/UpdateBrandController";
import { makeDeleteBrandController } from "../controllers/DeleteBrandController";

export async function brandRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [authorize("catalog.write")] }, makeCreateBrandController());
  app.get("/", { preHandler: [authorize("catalog.read")] }, makeListBrandsController());
  app.get("/:id", { preHandler: [authorize("catalog.read")] }, makeGetBrandController());
  app.put("/:id", { preHandler: [authorize("catalog.write")] }, makeUpdateBrandController());
  app.delete("/:id", { preHandler: [authorize("catalog.delete")] }, makeDeleteBrandController());
}
