import { z } from "zod";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { NFE_IMPORT_STATUSES } from "@nfe-import/domain/NfeImportStatus";

export const nfeImportIdParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export const listNfeImportsSchema = paginationSchema.extend({
  status: z.enum(NFE_IMPORT_STATUSES, { error: "Status inválido." }).optional(),
});
