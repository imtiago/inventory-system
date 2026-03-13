// /src/modules/customer/infrastructure/http/routes/customerRoutes.ts
import { FastifyInstance } from "fastify";
import { CreateCustomerController } from "../controllers/CreateCustomerController";
import { ListCustomersController } from "../controllers/ListCustomersController";
import { GetCustomerController } from "../controllers/GetCustomerController";

export async function customerRoutes(app: FastifyInstance) {
  app.post("/", CreateCustomerController);
  app.get("/:id", GetCustomerController);
  app.get("/", ListCustomersController);
}
