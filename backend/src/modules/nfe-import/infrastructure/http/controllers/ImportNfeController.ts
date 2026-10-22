import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { ErrorCodes, ValidationError } from "@shared/domain/errors";
import { FastifyRequest, FastifyReply } from "fastify";
import {
  ImportMode,
  ImportNfeUseCase,
} from "../../../application/useCases/ImportNfeUseCase";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { NfeImportRepository } from "../../../infrastructure/repositories/NfeImportRepository";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";

interface File {
  fieldname: string;
  filename: string;
  encoding: string;
  mimetype: string;
  filepath: string;
  file: any;
}

const querySchema = z.object({
  mode: z
    .nativeEnum(ImportMode, { message: "Modo de importação inválido." })
    .optional(),
});

export function makeImportNfeController(
  // productRepository: ProductRepository,
  nfeImportRepository: NfeImportRepository,
) {
  return async function ImportNfeController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const productRepository = new PrismaProductRepository();

    const file = await (req as any).file();
    if (!file) {
      throw new ValidationError(
        "Arquivo obrigatório.",
        [{ field: "file", message: "Arquivo obrigatório." }],
        ErrorCodes.FILE_REQUIRED,
      );
    }
    const buffer = await file.toBuffer(); // pega o conteúdo do arquivo
    const fileName = file.filename;

    const useCase = new ImportNfeUseCase(
      productRepository,
      nfeImportRepository,
    );
    const query = parseInput(querySchema, req.query);
    const mode = query.mode ?? ImportMode.UPSERT;

    const items = await useCase.executeBuffer(buffer, fileName, mode);

    return reply.status(200).send({
      message: "Import successful",
      imported: items.length,
      items,
      fileName, // path retornado para o front-end
    });
  };
}
