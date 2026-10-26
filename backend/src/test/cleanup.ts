import type { Prisma } from "@prisma/client";
import { prisma } from "@shared/prisma";

/**
 * Apaga documentos financeiros dos testes. O banco usa ON DELETE RESTRICT em
 * parcelas e pagamentos (histórico não some em cascata), então os filhos saem antes.
 */
export async function deleteFinancialDocuments(args: { where: Prisma.FinancialDocumentWhereInput }): Promise<void> {
  await prisma.payment.deleteMany({ where: { parcel: { document: args.where } } });
  await prisma.financialParcel.deleteMany({ where: { document: args.where } });
  await prisma.financialDocument.deleteMany(args);
}
