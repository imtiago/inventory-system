import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CreateSupplierUseCase } from "@purchases/application/useCases/commands/CreateSupplierUseCase";
import { DeleteSupplierUseCase } from "@purchases/application/useCases/commands/DeleteSupplierUseCase";
import { UpdateSupplierUseCase } from "@purchases/application/useCases/commands/UpdateSupplierUseCase";
import { GetSupplierByIdUseCase } from "@purchases/application/useCases/queries/GetSupplierByIdUseCase";
import { ListSuppliersUseCase } from "@purchases/application/useCases/queries/ListSuppliersUseCase";
import { PrismaSupplierReadRepository } from "../../prisma/contracts/PrismaSupplierReadRepository";
import { PrismaSupplierRepository } from "../../prisma/repositories/PrismaSupplierRepository";

export const makeCreateSupplierUseCase = () =>
  new CreateSupplierUseCase(new PrismaSupplierRepository(), new PrismaTransactionManager());

export const makeUpdateSupplierUseCase = () =>
  new UpdateSupplierUseCase(new PrismaSupplierRepository(), new PrismaTransactionManager());

export const makeDeleteSupplierUseCase = () =>
  new DeleteSupplierUseCase(new PrismaSupplierRepository(), new PrismaTransactionManager());

export const makeGetSupplierUseCase = () => new GetSupplierByIdUseCase(new PrismaSupplierReadRepository());

export const makeListSuppliersUseCase = () => new ListSuppliersUseCase(new PrismaSupplierReadRepository());
