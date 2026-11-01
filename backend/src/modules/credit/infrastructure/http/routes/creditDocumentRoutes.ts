import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { contentDisposition } from "@shared/http/contentDisposition";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { authorize } from "../../../../../shared/middleware/authorize";
import { PrismaStoreSettingsRepository } from "@credit/infrastructure/prisma/PrismaStoreSettingsRepository";
import { PrismaCreditDocumentsReader } from "@credit/infrastructure/prisma/PrismaCreditDocumentsReader";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";
import { CreditDocumentsPdfService } from "@credit/infrastructure/pdf/CreditDocumentsPdfService";
import { GetStoreSettingsUseCase, UpdateStoreSettingsUseCase } from "@credit/application/useCases/StoreSettingsUseCases";
import { GenerateCarneUseCase, GenerateReceiptUseCase, type GeneratedPdf } from "@credit/application/useCases/CreditDocumentsUseCases";
import { carneParamsSchema, receiptParamsSchema, updateStoreSettingsSchema } from "@credit/interfaces/http/schemas/storeSettingsSchemas";

function sendPdf(reply: FastifyReply, { pdf, filename }: GeneratedPdf) {
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", contentDisposition("inline", filename))
    .header("Cache-Control", "private, no-store")
    .send(pdf);
}

/** Dados da loja, carnê e recibo (PDF). Caminhos completos: vivem sob /settings, /sales e /receivables. */
export async function creditDocumentRoutes(app: FastifyInstance) {
  const store = new PrismaStoreSettingsRepository();
  const reader = new PrismaCreditDocumentsReader();
  const pdf = new CreditDocumentsPdfService();
  const getStore = new GetStoreSettingsUseCase(store);
  const updateStore = new UpdateStoreSettingsUseCase(store, new PrismaTransactionManager());
  const carne = new GenerateCarneUseCase(reader, store, new PrismaCreditSettingsRepository(), pdf);
  const receipt = new GenerateReceiptUseCase(reader, store, pdf);

  // Leitura para quem vende (tela do carnê); edição só ADMIN.
  app.get("/settings/store", { preHandler: [authorize("sales.read")] }, async (_request, reply) =>
    reply.send(HttpResponse.ok(await getStore.execute())),
  );
  app.put("/settings/store", { preHandler: [authorize("credit.manage")] }, async (request: FastifyRequest, reply) => {
    const body = parseInput(updateStoreSettingsSchema, request.body);
    return reply.send(HttpResponse.ok(await updateStore.execute(body)));
  });

  app.get("/sales/:id/carne.pdf", { preHandler: [authorize("sales.read")] }, async (request, reply) => {
    const { id } = parseInput(carneParamsSchema, request.params);
    return sendPdf(reply, await carne.execute(id));
  });

  app.get("/receivables/payments/:paymentId/receipt.pdf", { preHandler: [authorize("finance.read")] }, async (request, reply) => {
    const { paymentId } = parseInput(receiptParamsSchema, request.params);
    return sendPdf(reply, await receipt.execute(paymentId));
  });
}
