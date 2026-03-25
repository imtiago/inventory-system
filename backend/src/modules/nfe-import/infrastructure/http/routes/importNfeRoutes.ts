import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart"; // ✔️ pacote correto
import { makeImportNfeController } from "../controllers/ImportNfeController";
import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { NfeImportRepository } from "modules/nfe-import/infrastructure/repositories/NfeImportRepository";

export async function importNfeRoutes(app: FastifyInstance) {
  // ✅ registro correto do plugin
  await app.register(multipart, {
    // attachFieldsToBody: true, // ✔ substitui addToBody
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    },
  });

  const productRepository = new PrismaProductRepository();
  const nfeImportRepository = new NfeImportRepository();
  const importController = makeImportNfeController(
    productRepository,
    nfeImportRepository,
  );

  app.post("/nfe-import", importController);
}
