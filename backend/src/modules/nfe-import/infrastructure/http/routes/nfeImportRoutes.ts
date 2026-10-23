import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { authorize } from "@shared/middleware/authorize";
import {
  makeConfirmNfeImportController,
  makeDiscardNfeImportController,
  makeGetNfeImportController,
  makeListNfeImportsController,
  makeUploadNfeImportController,
} from "../controllers/nfeImportControllers";

/** XML da NF-e: até 10 MB, um arquivo por envio. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function nfeImportRoutes(app: FastifyInstance) {
  // Registrado dentro deste plugin: o parser multipart vale só para /nfe-imports.
  // throwFileSizeLimit false: o controller vê `truncated` e responde 400 FILE_TOO_LARGE.
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE, files: 1 }, throwFileSizeLimit: false });

  app.post("/", { preHandler: [authorize("purchases.write")] }, makeUploadNfeImportController());
  app.get("/", { preHandler: [authorize("purchases.write")] }, makeListNfeImportsController());
  app.get("/:id", { preHandler: [authorize("purchases.write")] }, makeGetNfeImportController());
  app.delete("/:id", { preHandler: [authorize("purchases.write")] }, makeDiscardNfeImportController());
  app.post("/:id/confirm", { preHandler: [authorize("purchases.write")] }, makeConfirmNfeImportController());
}
