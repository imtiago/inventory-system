// src/modules/users/infrastructure/http/routes/userRoutes.ts
import { FastifyInstance } from "fastify";
import { CreateUserController } from "../controllers/CreateUserController";
import { AuthenticateUserController } from "../controllers/AuthenticateUserController";
import { ListUsersController } from "../controllers/ListUsersController";
import { authenticate } from "../../../../../shared/middleware/auth";
import { authorize } from "../../../../../shared/middleware/authorize";

export async function userRoutes(app: FastifyInstance) {
  app.post("/users", CreateUserController);
  app.post("/auth/login", AuthenticateUserController);

  // rota protegida
  app.get(
    "/users",
    { preHandler: [authenticate, authorize(["admin", "vendedor"])] },
    ListUsersController,
  );
}
