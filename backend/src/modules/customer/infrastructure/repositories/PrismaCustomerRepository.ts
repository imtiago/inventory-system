// /src/modules/customer/infrastructure/repositories/PrismaCustomerRepository.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";
import { prisma } from "../../../../shared/prisma";

export class PrismaCustomerRepository implements CustomerRepository {
  async create(customer: Customer): Promise<Customer> {
    const created = await prisma.customer.create({ data: { ...customer } });
    return created as unknown as Customer;
  }

  async list(page: number, limit: number): Promise<Customer[]> {
    const skip = (page - 1) * limit;
    const customers = await prisma.customer.findMany({ skip, take: limit });
    return customers as unknown as Customer[];
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = await prisma.customer.findUnique({ where: { id } });
    return customer as unknown as Customer | null;
  }

  async update(customer: Customer): Promise<Customer> {
    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: { ...customer },
    });
    return updated as unknown as Customer;
  }
}
