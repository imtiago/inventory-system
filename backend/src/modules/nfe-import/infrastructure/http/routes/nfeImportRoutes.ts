import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { authorize } from "@shared/middleware/authorize";
import {
  makeDiscardNfeImportController,
  makeGetNfeImportController,
  makeListNfeImportsController,
  makeUploadNfeImportController,
} from "../controllers/nfeImportControllers";

/** XML da NF-e: até 10 MB, um arquivo por envio. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function nfeImportRoutes(app: FastifyInstance) {
  // Registrado dentro deste plugin: o parser multipart vale só para /nfe-imports.
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE, files: 1 } });

  app.post("/", { preHandler: [authorize("purchases.write")] }, makeUploadNfeImportController());
  app.get("/", { preHandler: [authorize("purchases.write")] }, makeListNfeImportsController());
  app.get("/:id", { preHandler: [authorize("purchases.write")] }, makeGetNfeImportController());
  app.delete("/:id", { preHandler: [authorize("purchases.write")] }, makeDiscardNfeImportController());
}
