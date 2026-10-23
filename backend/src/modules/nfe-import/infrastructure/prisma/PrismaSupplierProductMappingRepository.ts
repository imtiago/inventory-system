import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import {
  SupplierProductMappingInput,
  SupplierProductMappingRepository,
} from "@nfe-import/application/contracts/SupplierProductMappingRepository";

export class PrismaSupplierProductMappingRepository implements SupplierProductMappingRepository {
  async upsert(m: SupplierProductMappingInput): Promise<void> {
    // ON CONFLICT atômico: duas confirmações de notas diferentes do mesmo fornecedor não
    // colidem num P2002 (o upsert do Prisma faz SELECT + INSERT).
    await getDb().$executeRaw`
      INSERT INTO "SupplierProductMapping" ("id", "supplierId", "supplierCode", "productVariantId", "unitsPerPackage", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${m.supplierId}, ${m.supplierCode}, ${m.productVariantId}, ${m.unitsPerPackage}, now(), now())
      ON CONFLICT ("supplierId", "supplierCode")
      DO UPDATE SET "productVariantId" = EXCLUDED."productVariantId",
                    "unitsPerPackage" = EXCLUDED."unitsPerPackage",
                    "updatedAt" = now()`;
  }
}
