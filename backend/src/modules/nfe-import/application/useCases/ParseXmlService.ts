// src/modules/nfe-import/application/services/ParseXmlService.ts
import { NfeItem } from "../../domain/entities/NfeItem";
import * as xml2js from "xml2js";

export class ParseXmlService {
  parse(filePath: string): NfeItem[] {
    // código antigo que lê do path
    // fs.readFileSync(filePath)...
    throw new Error("Old parse not implemented here");
  }

  parseBuffer(buffer: Buffer): NfeItem[] {
    const xml = buffer.toString("utf-8");
    const items: NfeItem[] = [];
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) throw err;

      // Exemplo de mapeamento, ajuste conforme seu XML
      const products = result.nfe?.products?.product || [];
      for (const p of Array.isArray(products) ? products : [products]) {
        items.push(
          new NfeItem({
            code: p.code,
            name: p.name,
            quantity: parseFloat(p.quantity),
            unit: p.unit,
            price: parseFloat(p.price),
          }),
        );
      }
    });

    return items;
  }
}
