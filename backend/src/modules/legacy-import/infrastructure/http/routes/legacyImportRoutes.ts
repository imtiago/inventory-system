import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { authorize } from "@shared/middleware/authorize";
import {
  makeAddLegacyRowsController,
  makeCreateLegacyBatchController,
  makeDeleteLegacyBatchController,
  makeGetLegacyBatchController,
  makeListLegacyBatchesController,
  makeUpdateLegacyRowController,
  makeUploadLegacyCsvController,
  templateController,
} from "../controllers/legacyImportControllers";

/** CSV do caderninho: até 1 MB, um arquivo por envio. */
const MAX_FILE_SIZE = 1024 * 1024;

export async function legacyImportRoutes(app: FastifyInstance) {
  // Multipart registrado dentro deste plugin: vale só para /legacy-imports.
  await app.register(multipart, { limits: { fileSize: MAX_FILE_SIZE, files: 1 }, throwFileSizeLimit: false });
  const manage = { preHandler: [authorize("credit.manage")] };

  app.get("/template.csv", manage, templateController);
  app.post("/csv", manage, makeUploadLegacyCsvController());
  app.post("/", manage, makeCreateLegacyBatchController());
  app.get("/", manage, makeListLegacyBatchesController());
  app.get("/:id", manage, makeGetLegacyBatchController());
  app.delete("/:id", manage, makeDeleteLegacyBatchController());
  app.post("/:id/rows", manage, makeAddLegacyRowsController());
  app.patch("/:id/rows/:rowId", manage, makeUpdateLegacyRowController());
}
