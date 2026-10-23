import { Payment } from "../entities/Payment";

export interface PaymentRepository {
  create(payment: Payment): Promise<void>;
  /** Grava os campos de estorno (únicos mutáveis). */
  saveReversal(payment: Payment): Promise<void>;
  /** Id do documento da parcela do pagamento (leitura sem trava) ou null se não existe. */
  findDocumentId(paymentId: string): Promise<string | null>;
}
