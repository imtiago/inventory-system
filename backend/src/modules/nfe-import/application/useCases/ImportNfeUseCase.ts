import { NfeItem } from "../../domain/entities/NfeItem";
import { ParseXmlService } from "./ParseXmlService";
import { ParsePdfService } from "./ParsePdfService";
import { NfeImportRepository } from "../../infrastructure/repositories/NfeImportRepository";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

export enum ImportMode {
  INSERT_ONLY = "INSERT_ONLY", // apenas novos produtos
  UPDATE_ONLY = "UPDATE_ONLY", // apenas atualizar estoque
  UPSERT = "UPSERT", // atualizar ou inserir
}

export class ImportNfeUseCase {
  constructor(
    private productRepository: ProductRepository,
    private nfeImportRepository: NfeImportRepository,
  ) {}

  async executeBuffer(buffer: Buffer, fileName: string, mode: ImportMode) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    let items: NfeItem[] = [];

    if (ext === "xml") {
      items = new ParseXmlService().parseBuffer(buffer);
    } else if (ext === "pdf") {
      items = await new ParsePdfService().parseBuffer(buffer);
    } else {
      throw new Error("Unsupported file format");
    }

    for (const item of items) {
      const existing = await this.productRepository.findByCode(item.code);

      if (existing) {
        // if (mode === ImportMode.UPDATE_ONLY || mode === ImportMode.UPSERT) {
        //   // Atualiza estoque
        //   await this.productRepository.updateStock(existing.id, item.quantity);
        // }
      } else {
        if (mode === ImportMode.INSERT_ONLY || mode === ImportMode.UPSERT) {
          // Cria novo produto
          await this.productRepository.create({
            code: item.code,
            name: item.name,
            // stock: item.quantity,
            unit: item.unit,
            price: item.price,
          });
        }
      }
    }

    await this.nfeImportRepository.save(filePath, items);
    return items;
  }
}
