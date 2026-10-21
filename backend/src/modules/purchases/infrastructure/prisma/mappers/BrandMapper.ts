// src/modules/catalog/infrastructure/mappers/BrandMapper.ts

import { Brand } from "@catalog/domain/entities/Brand";
import { Brand as PrismaBrand } from "@prisma/client";

export class BrandMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaBrand): Brand {
    return new Brand({
      id: prisma.id,
      name: prisma.name,
      createdAt: prisma.createdAt,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(brand: Brand): PrismaBrand {
    return {
      id: brand.id,
      name: brand.name,
      createdAt: brand.createdAt,
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(brand: Brand): PrismaBrand {
    return {
      id: brand.id,
      name: brand.name,
      createdAt: brand.createdAt,
    };
  }
}
