import { NfeItem } from "../../domain/entities/NfeItem";
import { ParseXmlService } from "./ParseXmlService";
import { ParsePdfService } from "./ParsePdfService";
import { NfeImportRepository } from "../../infrastructure/repositories/NfeImportRepository";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { Product } from "@catalog/domain/entities/Product";

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
          const product = new Product({
            code: item.code,
            name: item.name,
            categoryId: "e49eb69f-bafb-4c89-86de-3d66314043b2",
            brandId: "eef7d276-7967-4503-89f5-90fe7cc686b0",
          });
          await this.productRepository.create(product);
        }
      }
    }

    await this.nfeImportRepository.save(filePath, items);
    return items;
  }
}
