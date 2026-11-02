import type { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { csvHeaders } from "@shared/http/csv";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { fileRequired } from "@nfe-import/domain/errors/nfeImportErrors";
import { buildLegacyTemplateCsv } from "../../../domain/legacyTemplate";
import { legacyFileTooLarge } from "../../../domain/legacyErrors";
import {
  addLegacyRowsSchema,
  confirmLegacyBatchSchema,
  createLegacyBatchSchema,
  legacyBatchParamsSchema,
  legacyRowParamsSchema,
  listLegacyBatchesSchema,
  updateLegacyRowSchema,
} from "../../../interfaces/http/schemas/legacyImportSchemas";
import {
  makeAddLegacyRowsUseCase,
  makeConfirmLegacyBatchUseCase,
  makeRevertLegacyBatchUseCase,
  makeCreateManualLegacyBatchUseCase,
  makeDeleteLegacyDraftUseCase,
  makeGetLegacyBatchUseCase,
  makeListLegacyBatchesUseCase,
  makeUpdateLegacyRowUseCase,
  makeUploadLegacyCsvUseCase,
} from "../factories/LegacyImportFactories";

export async function templateController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).headers(csvHeaders("modelo-caderninho", todayInBusinessTz())).send(buildLegacyTemplateCsv());
}

export function makeUploadLegacyCsvController() {
  const useCase = makeUploadLegacyCsvUseCase();
  return async function UploadLegacyCsvController(request: FastifyRequest, reply: FastifyReply) {
    if (!request.isMultipart()) throw fileRequired();
    const part = await request.file();
    if (!part) throw fileRequired();
    if (part.fieldname !== "file") {
      part.file.resume();
      throw fileRequired();
    }
    const bytes = await part.toBuffer();
    if (part.file.truncated) throw legacyFileTooLarge();
    const fileName = part.filename ? part.filename.slice(0, 200) : null;
    const batch = await useCase.execute({ bytes, fileName, userId: request.user?.sub ?? null });
    return reply.status(201).send(HttpResponse.created(batch));
  };
}

export function makeCreateLegacyBatchController() {
  const useCase = makeCreateManualLegacyBatchUseCase();
  return async function CreateLegacyBatchController(request: FastifyRequest, reply: FastifyReply) {
    parseInput(createLegacyBatchSchema, request.body);
    return reply.status(201).send(HttpResponse.created(await useCase.execute({ userId: request.user?.sub ?? null })));
  };
}

export function makeAddLegacyRowsController() {
  const useCase = makeAddLegacyRowsUseCase();
  return async function AddLegacyRowsController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(legacyBatchParamsSchema, request.params);
    const body = parseInput(addLegacyRowsSchema, request.body);
    return reply.status(201).send(HttpResponse.created(await useCase.execute({ batchId: id, ...body })));
  };
}

export function makeUpdateLegacyRowController() {
  const useCase = makeUpdateLegacyRowUseCase();
  return async function UpdateLegacyRowController(request: FastifyRequest, reply: FastifyReply) {
    const { id, rowId } = parseInput(legacyRowParamsSchema, request.params);
    const body = parseInput(updateLegacyRowSchema, request.body);
    return reply.send(HttpResponse.ok(await useCase.execute({ batchId: id, rowId, ...body })));
  };
}

export function makeListLegacyBatchesController() {
  const useCase = makeListLegacyBatchesUseCase();
  return async function ListLegacyBatchesController(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(HttpResponse.paginated(await useCase.execute(parseInput(listLegacyBatchesSchema, request.query))));
  };
}

export function makeGetLegacyBatchController() {
  const useCase = makeGetLegacyBatchUseCase();
  return async function GetLegacyBatchController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(legacyBatchParamsSchema, request.params);
    return reply.send(HttpResponse.ok(await useCase.execute(id)));
  };
}

export function makeDeleteLegacyBatchController() {
  const useCase = makeDeleteLegacyDraftUseCase();
  return async function DeleteLegacyBatchController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(legacyBatchParamsSchema, request.params);
    await useCase.execute({ id });
    return reply.status(204).send();
  };
}

export function makeConfirmLegacyBatchController() {
  const useCase = makeConfirmLegacyBatchUseCase();
  return async function ConfirmLegacyBatchController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(legacyBatchParamsSchema, request.params);
    const body = parseInput(confirmLegacyBatchSchema, request.body);
    const batch = await useCase.execute({ batchId: id, limitRule: body.limitRule, userId: request.user?.sub ?? null });
    return reply.send(HttpResponse.ok(batch));
  };
}

export function makeRevertLegacyBatchController() {
  const useCase = makeRevertLegacyBatchUseCase();
  return async function RevertLegacyBatchController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(legacyBatchParamsSchema, request.params);
    return reply.send(HttpResponse.ok(await useCase.execute({ batchId: id, userId: request.user?.sub ?? null })));
  };
}
