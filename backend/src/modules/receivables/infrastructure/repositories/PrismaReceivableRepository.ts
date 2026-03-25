// src/modules/receivables/infrastructure/repositories/PrismaReceivableRepository.ts
import { ReceivableRepository } from "../../domain/repositories/ReceivableRepository";
import { Receivable } from "../../domain/entities/Receivable";
import { Parcel } from "../../domain/entities/Parcel";
import { prisma } from "../../../../shared/prisma";
import { toDomain } from "../mappers/receivableMapper";

export class PrismaReceivableRepository implements ReceivableRepository {
  async create(data: Receivable, tx = prisma) {
    const receivable = await tx.receivable.create({
      data: {
        id: data.id,
        saleId: data.saleId,
        totalAmount: data.totalAmount,
        createdAt: data.createdAt,
        parcels: {
          create: data.parcels,
        },
      },
      include: {
        parcels: true,
      },
    });

    return toDomain(receivable);
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
