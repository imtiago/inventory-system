import { CustomerPatchData, CustomerRepository } from "@customer/domain/repositories/CustomerRepository";
import { CustomerMapper } from "../mappers/CustomerMapper";
import { Customer } from "@customer/domain/entities/Customer";
import { Prisma } from "@prisma/client";
import { customerDocumentExists } from "@customer/domain/errors";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

/** Corrida entre a checagem do use case e a gravação: o índice único parcial decide. */
function mapUniqueDocument(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw customerDocumentExists();
  }
  throw error;
}

export class PrismaCustomerRepository implements CustomerRepository {
  async create(customer: Customer): Promise<Customer> {
    const created = await getDb()
      .customer.create({ data: CustomerMapper.toCreatePersistence(customer) })
      .catch(mapUniqueDocument);

    return CustomerMapper.toDomain(created);
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = await getDb().customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return null;
    }

    return CustomerMapper.toDomain(customer);
  }

  async findByDocument(document: string): Promise<Customer | null> {
    const row = await getDb().customer.findFirst({ where: { document } });
    return row ? CustomerMapper.toDomain(row) : null;
  }

  async update(id: string, patch: CustomerPatchData): Promise<Customer> {
    const updated = await getDb()
      .customer.update({
        where: { id },
        data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.document !== undefined ? { document: patch.document } : {}),
      },
    })
      .catch(mapUniqueDocument);

    return CustomerMapper.toDomain(updated);
  }
}
