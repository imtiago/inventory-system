import Fastify from "fastify";
import { responseInterceptor } from "./shared/http/responseInterceptor";
import { productRoutes } from "./modules/catalog/infrastructure/http/routes/productRoutes";
import { brandRoutes } from "./modules/catalog/infrastructure/http/routes/brandRoutes";
import { categoryRoutes } from "./modules/catalog/infrastructure/http/routes/categoryRoutes";
import { saleRoutes } from "./modules/sales/infrastructure/http/routes/saleRoutes";
import { inventoryRoutes } from "./modules/inventory/infrastructure/http/routes/inventoryRoutes";
import { customerRoutes } from "./modules/customer/infrastructure/http/routes/customerRoutes";
import { userRoutes } from "./modules/auth/infrastructure/http/routes/userRoutes";
import { authenticate } from "./shared/middleware/auth";
import { receivableRoutes } from "@receivables/infrastructure/http/routes/receivableRoutes";
import { payableRoutes } from "@payables/infrastructure/http/routes/payableRoutes";
import { ZodError } from "zod";
import { AppError } from "./shared/errors/AppError";

import cors from "@fastify/cors";
import { importNfeRoutes } from "modules/nfe-import/interfaces/http/routes/importNfeRoutes";

export const app = Fastify({
  logger: true,
});

app.register(responseInterceptor);
app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      data: null,
      message: "Erro de validação",
      errors: error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
        code: e.code,
      })),
    });
  }
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      data: null,
      message: error.message,
    });
  }

  if (error instanceof Error) {
    return reply.status(500).send({
      success: false,
      data: null,
      message: error.message,
    });
  }

  return reply.status(500).send({
    success: false,
    data: null,
    message: "Erro desconhecido",
  });
});
// Lista de rotas públicas
const publicRoutes = [
  "/users", // criação de usuário
  "/auth/login", // login
];

// Middleware global
app.addHook("onRequest", async (request, reply) => {
  if (!publicRoutes.includes(request.url)) {
    await authenticate(request, reply);
  }
});

app.register(productRoutes, { prefix: "/products" });
app.register(brandRoutes, { prefix: "/brands" });
app.register(categoryRoutes, { prefix: "/categories" });
app.register(saleRoutes, { prefix: "/sales" });
app.register(customerRoutes, { prefix: "/customers" });
app.register(inventoryRoutes, { prefix: "/inventory" });
app.register(receivableRoutes);
app.register(payableRoutes);
app.register(userRoutes);
app.register(importNfeRoutes);
