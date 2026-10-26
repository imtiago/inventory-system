import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { hasPermission } from "@shared/auth/permissions";
import { ForbiddenError } from "@shared/domain/errors";
import { fileRequired, fileTooLarge } from "@nfe-import/domain/errors/nfeImportErrors";
import {
  confirmNfeImportBodySchema,
  listNfeImportsSchema,
  nfeImportIdParamsSchema,
} from "@nfe-import/interfaces/http/schemas/nfeImportSchemas";
import {
  makeConfirmNfeImportUseCase,
  makeDiscardNfeImportUseCase,
  makeGetNfeImportUseCase,
  makeListNfeImportsUseCase,
  makeRevertNfeImportUseCase,
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
  const content = await part.toBuffer();
  // Acima de 10 MB o conteúdo vem cortado (throwFileSizeLimit: false no registro).
  if (part.file.truncated) throw fileTooLarge();
  return content;
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

export function makeConfirmNfeImportController() {
  const useCase = makeConfirmNfeImportUseCase();
  return async function ConfirmNfeImportController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(nfeImportIdParamsSchema, request.params);
    const body = parseInput(confirmNfeImportBodySchema, request.body);
    // A rota exige purchases.write; dar entrada no estoque exige também purchases.receive.
    if (body.receive && !hasPermission(request.user!.role, "purchases.receive")) throw new ForbiddenError();
    const result = await useCase.execute({ id, userId: request.user!.sub, ...body });
    return reply.status(201).send(HttpResponse.created(result));
  };
}

/** Desfaz a importação (spec §4 da onda 7) e devolve o detalhe já REVERTED. */
export function makeRevertNfeImportController() {
  const useCase = makeRevertNfeImportUseCase();
  const getNfeImport = makeGetNfeImportUseCase();
  return async function RevertNfeImportController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(nfeImportIdParamsSchema, request.params);
    await useCase.execute({ id, userId: request.user!.sub });
    return reply.send(HttpResponse.ok(await getNfeImport.execute(id)));
  };
}
