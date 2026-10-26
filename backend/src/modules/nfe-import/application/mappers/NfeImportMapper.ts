import { fromCents } from "@shared/domain/money";
import { itemCostCents, QUANTITY_SCALE, quantityToNumber, quantityToScaled } from "@nfe-import/domain/NfeDocument";
import { NfeImportRecord } from "../contracts/NfeImportReadRepository";
import { NfeImportDTO } from "../dto/NfeImportDTO";
import { NfeSuggestions } from "../services/NfeSuggestionService";

/** Custo unitário em reais com 4 casas: custo total / quantidade, meio para cima, em inteiros (BigInt). */
export function unitCostFromNfe(costCents: number, quantity: string): number {
  const scaled = BigInt(quantityToScaled(quantity));
  const sign = costCents < 0 ? -1 : 1;
  // custo em 1/10000 = (centavos × 100) / (scaled / QUANTITY_SCALE)
  const numerator = BigInt(Math.abs(costCents)) * 100n * BigInt(QUANTITY_SCALE);
  const quotient = numerator / scaled;
  const rest = numerator - quotient * scaled;
  const rounded = rest * 2n >= scaled ? quotient + 1n : quotient;
  return (sign * Number(rounded)) / 10_000;
}

export class NfeImportMapper {
  static toDTO(record: NfeImportRecord, suggestions: NfeSuggestions): NfeImportDTO {
    const doc = record.document;
    const orderTotal = doc.items.reduce((sum, item) => sum + itemCostCents(item), 0);
    const installmentsTotal = doc.installments.reduce((sum, i) => sum + i.amount, 0);
    return {
      id: record.id,
      accessKey: record.accessKey,
      status: record.status,
      number: doc.number,
      series: doc.series,
      issueDate: doc.issueDate,
      totalAmount: fromCents(doc.totals.total),
      totals: {
        total: fromCents(doc.totals.total),
        orderTotal: fromCents(orderTotal),
        difference: fromCents(doc.totals.total - orderTotal),
        installmentsTotal: fromCents(installmentsTotal),
        installmentsDifference: fromCents(installmentsTotal === 0 ? 0 : installmentsTotal - orderTotal),
      },
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
          unitCost: unitCostFromNfe(cost, item.quantity),
          total: fromCents(cost),
          composesTotal: item.composesTotal,
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
