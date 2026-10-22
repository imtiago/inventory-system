import { CustomerRepository } from "@customer/domain/repositories/CustomerRepository";
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

  async list(page: number, limit: number): Promise<Customer[]> {
    const skip = (page - 1) * limit;

    const customers = await getDb().customer.findMany({
      skip,
      take: limit,
    });

    return customers.map(CustomerMapper.toDomain);
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

  async update(customer: Customer): Promise<Customer> {
    const updated = await getDb().customer.update({
      where: {
        id: customer.id,
      },
      data: CustomerMapper.toUpdatePersistence(customer),
    });

    return CustomerMapper.toDomain(updated);
  }
}
