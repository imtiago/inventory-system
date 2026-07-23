import { Receivable } from "@finance/domain/entities/Receivable";

export function toDomain(receivable: any): Receivable {
  return {
    id: receivable.id,
    saleId: receivable.saleId,
    totalAmount: receivable.totalAmount,
    createdAt: receivable.createdAt,
    parcels: receivable.parcels.map((p: any) => ({
      id: p.id,
      amount: p.amount,
      dueDate: p.dueDate,
      paid: p.paid,
      paidAt: p.paidAt ?? undefined, // 🔥 aqui resolve
    })),
  };
}
