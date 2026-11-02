import type { CarneInput, ReceiptInput } from "@credit/domain/carneContent";

export type CarneSaleRead =
  | { kind: "OK"; input: Omit<CarneInput, "store"> }
  | { kind: "NOT_CREDIARIO" }
  | { kind: "CANCELED" };

export type ReceiptPaymentRead = { kind: "OK"; input: Omit<ReceiptInput, "store"> } | { kind: "REVERSED" };

/** Dados para os PDFs; `null` = venda/pagamento inexistente. */
export interface CreditDocumentsReader {
  carneSale(saleId: string): Promise<CarneSaleRead | null>;
  receiptPayment(paymentId: string): Promise<ReceiptPaymentRead | null>;
}
