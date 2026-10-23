import { divideCentsRoundHalfUp, fromCents } from "@shared/domain/money";
import { itemCostCents, QUANTITY_SCALE, quantityToNumber, quantityToScaled } from "@nfe-import/domain/NfeDocument";
import { NfeImportRecord } from "../contracts/NfeImportReadRepository";
import { NfeImportDTO } from "../dto/NfeImportDTO";
import { NfeSuggestions } from "../services/NfeSuggestionService";

/** Custo unitário em centavos: custo total / quantidade (até 4 casas), meio para cima, em inteiros. */
export function unitCostCents(costCents: number, quantity: string): number {
  const scaled = quantityToScaled(quantity);
  const sign = costCents < 0 ? -1 : 1;
  return sign * divideCentsRoundHalfUp(Math.abs(costCents) * QUANTITY_SCALE, scaled);
}

export class NfeImportMapper {
  static toDTO(record: NfeImportRecord, suggestions: NfeSuggestions): NfeImportDTO {
    const doc = record.document;
    return {
      id: record.id,
      accessKey: record.accessKey,
      status: record.status,
      number: doc.number,
      series: doc.series,
      issueDate: doc.issueDate,
      totalAmount: fromCents(doc.totals.total),
      purchaseId: record.purchaseId,
      createdAt: record.createdAt,
      supplier: { document: doc.supplier.document, name: doc.supplier.name, match: suggestions.supplier },
      items: doc.items.map((item) => {
        const cost = itemCostCents(item);
        return {
          index: item.index,
          supplierCode: item.supplierCode,
          barcode: item.barcode,
          name: item.name,
          unit: item.unit,
          quantity: quantityToNumber(item.quantity),
          unitCost: fromCents(unitCostCents(cost, item.quantity)),
          total: fromCents(cost),
          lots: item.lots.map((lot) => ({
            batchNumber: lot.batchNumber,
            quantity: quantityToNumber(lot.quantity),
            manufacturingDate: lot.manufacturingDate,
            expirationDate: lot.expirationDate,
          })),
          suggestion: suggestions.items.get(item.index) ?? null,
        };
      }),
      installments: doc.installments.map((i) => ({
        number: i.number,
        dueDate: i.dueDate,
        amount: fromCents(i.amount),
      })),
    };
  }
}
