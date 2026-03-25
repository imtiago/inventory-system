import { FastifyRequest, FastifyReply } from "fastify";
import {
  ImportMode,
  ImportNfeUseCase,
} from "../../../application/useCases/ImportNfeUseCase";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { NfeImportRepository } from "../../../infrastructure/repositories/NfeImportRepository";

interface File {
  fieldname: string;
  filename: string;
  encoding: string;
  mimetype: string;
  filepath: string;
  file: any;
}

export function makeImportNfeController(
  productRepository: ProductRepository,
  nfeImportRepository: NfeImportRepository,
) {
  return async function ImportNfeController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const file = await (req as any).file(); // ✅ correto

      console.log("tiago da silva oliveira");
      // const files = [];
      // for await (const file of req.files()) {
      //   files.push(file);
      // }

      // if (!files.length) {
      //   return reply.status(400).send({ error: "File required" });
      // }

      // const file = files[0];
      const buffer = await file.toBuffer(); // pega o conteúdo do arquivo
      const fileName = file.filename;

      const useCase = new ImportNfeUseCase(
        productRepository,
        nfeImportRepository,
      );
      const mode = ((req.query as any).mode as ImportMode) || ImportMode.UPSERT;
      console.log(mode);

      const items = await useCase.executeBuffer(buffer, fileName, mode);

      return reply.status(200).send({
        message: "Import successful",
        imported: items.length,
        items,
        fileName, // path retornado para o front-end
      });
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ error: err.message });
    }
  };
}
