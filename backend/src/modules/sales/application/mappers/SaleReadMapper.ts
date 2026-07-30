import { SaleDTO } from "../dto/SaleDTO";

export class SaleReadMapper {
  static toDTO(data: any): SaleDTO {
    return {
      id: data.id,
      createdAt: data.createdAt,
      totalAmount: data.totalAmount,
      status: data.status,

      customer: {
        id: data.customer.id,
        name: data.customer.name,
      },

      items: data.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.quantity * item.price,
      })),
    };
  }
}
