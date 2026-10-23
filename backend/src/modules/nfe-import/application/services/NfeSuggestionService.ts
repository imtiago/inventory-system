import { normalizeDocument } from "@shared/domain/document";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { NfeSuggestionLookup, SuggestedVariant } from "../contracts/NfeSuggestionLookup";
import { NfeItemSuggestionDTO } from "../dto/NfeImportDTO";

export interface NfeSuggestions {
  supplier: { id: string; name: string } | null;
  /** Por `index` do item; ausente → sem sugestão. */
  items: Map<number, NfeItemSuggestionDTO>;
}

const labelOf = (v: SuggestedVariant) => `${v.productName} — ${v.variantName} (${v.variantCode})`;

/**
 * Sugestões calculadas na leitura (nada é guardado): fornecedor pelo documento da nota;
 * item pelo mapeamento do fornecedor (código do produto) e, sem mapeamento, pelo código
 * de barras de uma variante. No máximo três consultas, qualquer que seja o número de itens.
 */
export class NfeSuggestionService {
  constructor(private lookup: NfeSuggestionLookup) {}

  async suggest(document: NfeDocument): Promise<NfeSuggestions> {
    const supplier = await this.lookup.findSupplierByDocument(normalizeDocument(document.supplier.document));
    const items = new Map<number, NfeItemSuggestionDTO>();

    if (supplier) {
      const codes = [...new Set(document.items.map((i) => i.supplierCode))];
      const mappings = new Map(
        (await this.lookup.findMappings(supplier.id, codes)).map((m) => [m.supplierCode, m]),
      );
      for (const item of document.items) {
        const m = mappings.get(item.supplierCode);
        if (m) {
          items.set(item.index, {
            source: "MAPPING",
            productVariantId: m.productVariantId,
            label: labelOf(m),
            unitsPerPackage: m.unitsPerPackage,
          });
        }
      }
    }

    const pending = document.items.filter((i) => !items.has(i.index) && i.barcode !== null);
    if (pending.length > 0) {
      const barcodes = [...new Set(pending.map((i) => i.barcode as string))];
      const variants = new Map((await this.lookup.findVariantsByBarcodes(barcodes)).map((v) => [v.barcode, v]));
      for (const item of pending) {
        const v = variants.get(item.barcode as string);
        if (v) {
          items.set(item.index, {
            source: "BARCODE",
            productVariantId: v.productVariantId,
            label: labelOf(v),
            unitsPerPackage: 1,
          });
        }
      }
    }

    return { supplier, items };
  }
}
