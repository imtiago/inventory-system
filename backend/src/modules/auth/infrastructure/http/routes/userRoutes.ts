// src/modules/users/infrastructure/http/routes/userRoutes.ts
import { FastifyInstance } from "fastify";
import { authenticate } from "../../../../../shared/middleware/auth";
import { authorize } from "../../../../../shared/middleware/authorize";
import { makeCreateUserController } from "../controllers/CreateUserController";
import { makeAuthenticateUserController } from "../controllers/AuthenticateUserController";
import { makeListUsersController } from "../controllers/ListUsersController";
import { PrismaUserRepository } from "@auth/infrastructure/prisma/repositories/PrismaUserRepository";

export async function userRoutes(app: FastifyInstance) {
  const userRepository = new PrismaUserRepository();

  app.post("/users", makeCreateUserController(userRepository));
  app.post("/auth/login", makeAuthenticateUserController(userRepository));

  // rota protegida
  app.get(
    "/users",
    { preHandler: [authenticate, authorize(["admin", "vendedor"])] },
    makeListUsersController(),
  );
}
