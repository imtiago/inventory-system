// src/modules/receivables/infrastructure/repositories/PrismaReceivableRepository.ts
import { ReceivableRepository } from "../../domain/repositories/ReceivableRepository";
import { Receivable } from "../../domain/entities/Receivable";
import { Parcel } from "../../domain/entities/Parcel";
import { prisma } from "../../../../shared/prisma";

export class PrismaReceivableRepository implements ReceivableRepository {
  async create(receivable: Receivable): Promise<Receivable> {
    const created = await prisma.receivable.create({
      data: {
        id: receivable.id,
        saleId: receivable.saleId,
        totalAmount: receivable.totalAmount,
        createdAt: receivable.createdAt,
        parcels: {
          create: receivable.parcels.map((p) => ({
            id: p.id,
            amount: p.amount,
            dueDate: p.dueDate,
            paid: p.paid,
          })),
        },
      },
      include: { parcels: true },
    });
    return created as unknown as Receivable;
  }

  async list(): Promise<Receivable[]> {
    const list = await prisma.receivable.findMany({
      include: { parcels: true },
    });
    return list as unknown as Receivable[];
  }

  async getById(id: string): Promise<Receivable | null> {
    const rec = await prisma.receivable.findUnique({
      where: { id },
      include: { parcels: true },
    });
    return rec as unknown as Receivable | null;
  }

  async markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel> {
    const updated = await prisma.parcel.update({
      where: { id: parcelId },
      data: { paid: true, paidAt },
    });
    return updated as unknown as Parcel;
  }
}
