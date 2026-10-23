import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";

/**
 * Cancela todos os documentos de uma origem (não há unicidade por origem).
 * Trava antes de checar pagamentos: um pagamento concorrente que também trave o
 * documento fica serializado com este cancelamento. Pagamento ativo (não
 * estornado) em qualquer documento → lança `onPayments()`; sem documento → nada.
 * Exige transação ativa.
 */
export async function cancelOriginDocuments(
  documents: FinancialDocumentRepository,
  origin: { type: FinancialType; originType: FinancialOriginType; originId: string },
  onPayments: () => Error,
): Promise<void> {
  const locked = await documents.lockByOrigin(origin.type, origin.originType, origin.originId);
  if (locked.length === 0) return;

  if (await documents.hasPayments(locked.map((d) => d.id))) throw onPayments();

  // Valida todos antes de gravar qualquer um.
  for (const document of locked) document.cancel();
  for (const document of locked) await documents.update(document);
}
