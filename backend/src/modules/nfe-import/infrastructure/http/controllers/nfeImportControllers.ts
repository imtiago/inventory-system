import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { fileRequired } from "@nfe-import/domain/errors/nfeImportErrors";
import {
  listNfeImportsSchema,
  nfeImportIdParamsSchema,
} from "@nfe-import/interfaces/http/schemas/nfeImportSchemas";
import {
  makeDiscardNfeImportUseCase,
  makeGetNfeImportUseCase,
  makeListNfeImportsUseCase,
  makeUploadNfeImportUseCase,
} from "../factories/NfeImportFactories";

/** Conteúdo do campo `file` do multipart (limite de tamanho no registro do plugin). */
async function readUploadedFile(request: FastifyRequest): Promise<Buffer> {
  if (!request.isMultipart()) throw fileRequired();
  const part = await request.file();
  if (!part) throw fileRequired();
  if (part.fieldname !== "file") {
    part.file.resume();
    throw fileRequired();
  }
  return part.toBuffer();
}

export function makeUploadNfeImportController() {
  const useCase = makeUploadNfeImportUseCase();
  return async function UploadNfeImportController(request: FastifyRequest, reply: FastifyReply) {
    const file = await readUploadedFile(request);
    const { created, nfeImport } = await useCase.execute({ file, userId: request.user?.sub ?? null });
    return reply.status(created ? 201 : 200).send(HttpResponse.ok(nfeImport));
  };
}

export function makeListNfeImportsController() {
  const useCase = makeListNfeImportsUseCase();
  return async function ListNfeImportsController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listNfeImportsSchema, request.query);
    return reply.send(HttpResponse.paginated(await useCase.execute(query)));
  };
}

export function makeGetNfeImportController() {
  const useCase = makeGetNfeImportUseCase();
  return async function GetNfeImportController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(nfeImportIdParamsSchema, request.params);
    return reply.send(HttpResponse.ok(await useCase.execute(id)));
  };
}

export function makeDiscardNfeImportController() {
  const useCase = makeDiscardNfeImportUseCase();
  return async function DiscardNfeImportController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(nfeImportIdParamsSchema, request.params);
    await useCase.execute({ id });
    return reply.status(204).send();
  };
}
