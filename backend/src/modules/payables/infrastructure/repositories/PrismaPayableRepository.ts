// src/modules/payables/infrastructure/repositories/PrismaPayableRepository.ts
import { Payable } from "@payables/domain/entities/Payable";
import { PayableParcel } from "@payables/domain/entities/PayableParcel";
import { PayableRepository } from "@payables/domain/repositories/PayableRepository";
import { prisma } from "@shared/prisma";

export class PrismaPayableRepository implements PayableRepository {
  async create(payable: Payable): Promise<Payable> {
    const created = await prisma.payable.create({
      data: {
        id: payable.id,
        purchaseId: payable.purchaseId,
        totalAmount: payable.totalAmount,
        createdAt: payable.createdAt,
        parcels: {
          create: payable.parcels.map((p) => ({
            id: p.id,
            amount: p.amount,
            dueDate: p.dueDate,
            paid: p.paid,
          })),
        },
      },
      include: { parcels: true },
    });
    return created as unknown as Payable;
  }

  async list(): Promise<Payable[]> {
    const list = await prisma.payable.findMany({ include: { parcels: true } });
    return list as unknown as Payable[];
  }

  async getById(id: string): Promise<Payable | null> {
    const payable = await prisma.payable.findUnique({
      where: { id },
      include: { parcels: true },
    });
    return payable as unknown as Payable | null;
  }

  async markParcelAsPaid(
    parcelId: string,
    paidAt: Date,
  ): Promise<PayableParcel> {
    const updated = await prisma.parcel.update({
      where: { id: parcelId },
      data: { paid: true, paidAt },
    });
    return updated as unknown as PayableParcel;
  }
}
