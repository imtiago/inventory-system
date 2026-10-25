import "./shared/config/zod";
import Fastify, { type FastifyPluginAsync, type FastifyRequest, type FastifyServerOptions } from "fastify";
import { registerErrorHandling } from "./shared/http/errorHandler";
import { productRoutes } from "./modules/catalog/infrastructure/http/routes/productRoutes";
import { brandRoutes } from "./modules/catalog/infrastructure/http/routes/brandRoutes";
import { categoryRoutes } from "./modules/catalog/infrastructure/http/routes/categoryRoutes";
import { saleRoutes } from "./modules/sales/infrastructure/http/routes/saleRoutes";
import { inventoryRoutes } from "./modules/inventory/infrastructure/http/routes/inventoryRoutes";
import { customerRoutes } from "./modules/customer/infrastructure/http/routes/customerRoutes";
import { supplierRoutes } from "./modules/purchases/infrastructure/http/routes/supplierRoutes";
import { purchaseRoutes } from "./modules/purchases/infrastructure/http/routes/purchaseRoutes";
import { userRoutes } from "./modules/auth/infrastructure/http/routes/userRoutes";
import { authenticate, verifiedSubject } from "./shared/middleware/auth";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./shared/config/env";
import { prisma } from "./shared/prisma";
import { TooManyRequestsError } from "@shared/domain/errors";
import { nfeImportRoutes } from "@nfe-import/infrastructure/http/routes/nfeImportRoutes";
import { payableRoutes, receivableRoutes } from "@finance/infrastructure/http/routes/financialDocumentRoutes";
import { dashboardRoutes } from "./modules/dashboard/infrastructure/http/routes/dashboardRoutes";
import { reportRoutes } from "./modules/reports/infrastructure/http/routes/reportRoutes";
import { productVariantsRoutes } from "@catalog/infrastructure/http/routes/productVariantsRoutes";

export type BuildAppOptions = {
  logger?: FastifyServerOptions["logger"];
  /** Verifica o banco para `/health`; lança se indisponível. Padrão: `SELECT 1`. */
  healthCheck?: () => Promise<void>;
  /** Limites por minuto; `false` desliga. Padrão: 300/min (20/min em /reports), ou desligado via RATE_LIMIT_DISABLED. */
  rateLimit?: { max: number; reportsMax: number } | false;
  /** Lista de origens do CORS; `undefined` reflete a origem (só fora de produção). */
  corsOrigins?: string[];
  trustProxy?: FastifyServerOptions["trustProxy"];
};

const RATE_LIMIT_DEFAULTS = { max: 300, reportsMax: 20 };

const defaultHealthCheck = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

// Classificação pela rota casada (já decodificada pelo roteador), nunca pela URL crua:
// `/%72eports/x` é servida por /reports/x. Sem rota casada (404) → `undefined`:
// exige token e cai no balde "api".
const routeOf = (request: FastifyRequest): string | undefined => request.routeOptions?.url;
const isReportsRoute = (route: string | undefined) =>
  route === "/reports" || (route?.startsWith("/reports/") ?? false);

// Rotas públicas: login e health check. Todas as demais passam por `authenticate`.
const publicRoutes = ["/auth/login", "/health"];

export function buildApp(options: BuildAppOptions = {}) {
  const rateLimitOptions =
    options.rateLimit !== undefined
      ? options.rateLimit
      : env.RATE_LIMIT_DISABLED
        ? false
        : RATE_LIMIT_DEFAULTS;
  const healthCheck = options.healthCheck ?? defaultHealthCheck;

  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 1024 * 1024,
    connectionTimeout: 60_000,
    requestTimeout: 60_000,
    trustProxy: options.trustProxy ?? env.TRUST_PROXY ?? false,
  });

  registerErrorHandling(app);
  app.register(helmet);
  app.register(cors, {
    origin: options.corsOrigins ?? env.CORS_ORIGINS ?? true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // O front lê o nome do CSV exportado e a marca de resposta repetida (idempotência).
    exposedHeaders: ["Content-Disposition", "Idempotent-Replayed"],
  });

  if (rateLimitOptions) {
    // `global: false`: o limite é aplicado manualmente no hook abaixo, que roda
    // antes de `authenticate` (hooks de rota do modo global rodam depois do auth).
    app.register(rateLimit, { global: false });
  }

  // Middleware global: rate limit (por `sub` de token assinado ou por IP) e depois autenticação.
  const guardPlugin: FastifyPluginAsync = async (instance) => {
    const limit = rateLimitOptions
      ? (() => {
          const { max, reportsMax } = rateLimitOptions;
          const isReports = (request: FastifyRequest) => isReportsRoute(routeOf(request));
          return instance.rateLimit({
            timeWindow: "1 minute",
            max: (request: FastifyRequest) => (isReports(request) ? reportsMax : max),
            keyGenerator: (request: FastifyRequest) =>
              `${isReports(request) ? "reports" : "api"}:${verifiedSubject(request) ?? request.ip}`,
            errorResponseBuilder: () =>
              new TooManyRequestsError(
                "Muitas requisições. Aguarde um instante e tente novamente.",
                "RATE_LIMITED",
              ),
          });
        })()
      : null;

    instance.addHook("onRequest", async (request, reply) => {
      const route = routeOf(request);
      if (limit && route !== "/health") {
        await limit.call(instance, request, reply);
      }
      if (route === undefined || !publicRoutes.includes(route)) {
        await authenticate(request);
      }
    });
  };
  // Equivale a fastify-plugin: o hook vale para a instância raiz, não só para o plugin.
  (guardPlugin as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
  app.register(guardPlugin);

  app.get("/health", async (_request, reply) => {
    try {
      await healthCheck();
      return { status: "ok" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  app.register(productRoutes, { prefix: "/products" });
  app.register(productVariantsRoutes, { prefix: "/variants" });
  app.register(brandRoutes, { prefix: "/brands" });
  app.register(categoryRoutes, { prefix: "/categories" });
  app.register(inventoryRoutes, { prefix: "/inventory" });

  app.register(saleRoutes, { prefix: "/sales" });
  app.register(customerRoutes, { prefix: "/customers" });
  app.register(supplierRoutes, { prefix: "/suppliers" });
  app.register(purchaseRoutes, { prefix: "/purchases" });
  app.register(receivableRoutes, { prefix: "/receivables" });
  app.register(payableRoutes, { prefix: "/payables" });
  app.register(userRoutes);
  app.register(nfeImportRoutes, { prefix: "/nfe-imports" });
  app.register(dashboardRoutes, { prefix: "/dashboard" });
  app.register(reportRoutes, { prefix: "/reports" });

  return app;
}

export const app = buildApp();
