import { CustomerPatchData, CustomerRepository } from "@customer/domain/repositories/CustomerRepository";
import { CustomerMapper } from "../mappers/CustomerMapper";
import { Customer } from "@customer/domain/entities/Customer";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaCustomerRepository implements CustomerRepository {
  async create(customer: Customer): Promise<Customer> {
    const created = await getDb().customer.create({
      data: CustomerMapper.toCreatePersistence(customer),
    });

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

  async update(id: string, patch: CustomerPatchData): Promise<Customer> {
    const updated = await getDb().customer.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
      },
    });

    return CustomerMapper.toDomain(updated);
  }
}
