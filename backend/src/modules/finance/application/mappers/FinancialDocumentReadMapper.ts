import { FinancialDocumentDTO } from "../dto/FinancialDocumentDTO";

export class FinancialDocumentReadMapper {
  static toDTO(data: any): FinancialDocumentDTO {
    const totalAmount = data.parcels.reduce(
      (total, parcel) => total + Number(parcel.amount),
      0,
    );

    return {
      id: data.id,

      type: data.type,

      originId: data.originId,
      originType: data.originType,

      partyId: data.partyId,
      partyType: data.partyType,

      status: data.status,

      createdAt: data.createdAt,

      totalAmount,

      parcels: data.parcels.map((parcel) => {
        const paidAmount = parcel.payments.reduce(
          (total, payment) => total + Number(payment.amount),
          0,
        );

        const remainingAmount = Number(parcel.amount) - paidAmount;

        let status = "OPEN";

        if (paidAmount >= Number(parcel.amount)) {
          status = "PAID";
        } else if (paidAmount > 0) {
          status = "PARTIALLY_PAID";
        } else if (parcel.dueDate < new Date()) {
          status = "OVERDUE";
        }

        return {
          id: parcel.id,

          amount: Number(parcel.amount),

          dueDate: parcel.dueDate,

          paidAmount,

          remainingAmount,

          status,

          payments: parcel.payments.map((payment) => ({
            id: payment.id,

            amount: Number(payment.amount),

            method: payment.method,

            reference: payment.reference,

            paymentDate: payment.paymentDate,
          })),
        };
      }),
    };
  }
}
