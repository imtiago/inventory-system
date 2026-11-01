import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { UseCase } from "@shared/domain/UseCase";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { toCents } from "@shared/domain/money";
import { ErrorCodes, ForbiddenError, NotFoundError, ValidationError } from "@shared/domain/errors";
import type { LateFeePolicy } from "../../contracts/LateFeePolicy";
import { FINANCIAL_TYPE_LABEL } from "@finance/domain/enums/financialTypeLabels";
import { FinancialDocumentDetailDTO } from "../../dto/FinancialDocumentReadDTO";

export interface IRegisterPaymentInput {
  documentId: string;
  parcelId: string;
  /** Valor monetário (até 2 casas). */
  amount: number;
  method: PaymentMethod;
  /** "YYYY-MM-DD"; padrão = hoje (negócio). */
  paymentDate?: string;
  reference?: string | null;
  userId: string;
  /** Dispensa de multa/juros (reais, só a receber); exige `canWaive` e motivo. */
  waiveAmount?: number;
  waiverReason?: string | null;
  /** O usuário tem `credit.approve` (papel ou marca): dispensa encargos e registra data passada (a receber). */
  canWaive?: boolean;
  /** A receber com `paymentDate` passada: motivo obrigatório (3–200), gravado no pagamento. */
  backdateReason?: string | null;
}

/** Monta a resposta (detalhe do documento) depois do commit. */
export interface FinancialDocumentDetailReader<T extends FinancialType> {
  execute(id: string): Promise<FinancialDocumentDetailDTO<T>>;
}

/**
 * Registra um pagamento numa parcela de uma conta a receber ou a pagar (o
 * `type` da instância; documento de outro tipo → 404 sem gravar). Trava o
 * documento (FOR UPDATE, mesma linha travada pelo cancelamento da venda/pedido)
 * e valida sob a trava: pagamentos concorrentes e cancelamento ficam serializados.
 */
export class RegisterPaymentUseCase<T extends FinancialType>
  implements UseCase<IRegisterPaymentInput, FinancialDocumentDetailDTO<T>>
{
  constructor(
    private readonly type: T,
    private readonly documents: FinancialDocumentRepository,
    private readonly payments: PaymentRepository,
    private readonly transactionManager: TransactionManager,
    private readonly detail: FinancialDocumentDetailReader<T>,
    private readonly today: () => string = () => todayInBusinessTz(),
    /** Encargos de atraso (só contas a receber); ausente = nunca cobra. */
    private readonly lateFees: LateFeePolicy | null = null,
  ) {}

  async execute(input: IRegisterPaymentInput): Promise<FinancialDocumentDetailDTO<T>> {
    const today = this.today();
    const paymentDate = input.paymentDate ?? today;
    if (paymentDate > today) {
      throw new ValidationError("Dados inválidos.", [
        { field: "paymentDate", message: "A data do pagamento não pode ser futura." },
      ]);
    }
    // A receber: data passada muda multa/juros e o histórico de crédito → só quem aprova crédito, com motivo.
    const backdated = this.type === FinancialType.RECEIVABLE && paymentDate < today;
    const backdateReason = backdated ? input.backdateReason?.trim() || null : null;
    if (backdated) {
      if (!input.canWaive) {
        throw new ForbiddenError(
          "Só quem pode aprovar crédito registra pagamento com data passada.",
          ErrorCodes.BACKDATED_PAYMENT_FORBIDDEN,
        );
      }
      if (!backdateReason || backdateReason.length < 3) {
        throw new ValidationError("Dados inválidos.", [
          { field: "backdateReason", message: "Informe o motivo da data passada (3 a 200 caracteres)." },
        ]);
      }
    }
    const reference = input.reference?.trim() || null;
    const amountCents = toCents(input.amount);
    const waivedCents = input.waiveAmount ? toCents(input.waiveAmount) : 0;
    const waiverReason = input.waiverReason?.trim() || null;
    if (waivedCents > 0) {
      if (!input.canWaive) {
        throw new ForbiddenError(
          "Só quem aprova crédito pode dispensar multa e juros.",
          ErrorCodes.LATE_FEE_WAIVER_FORBIDDEN,
        );
      }
      if (!waiverReason) {
        throw new ValidationError("Dados inválidos.", [
          { field: "waiverReason", message: "Informe o motivo da dispensa." },
        ]);
      }
    }

    await this.transactionManager.execute(async () => {
      const document = await this.documents.lockById(input.documentId);
      if (!document || document.type !== this.type) {
        throw new NotFoundError(
          `${FINANCIAL_TYPE_LABEL[this.type]} não encontrada.`,
          ErrorCodes.FINANCIAL_DOCUMENT_NOT_FOUND,
        );
      }
      if (paymentDate < todayInBusinessTz(document.createdAt)) {
        throw new ValidationError("Dados inválidos.", [
          { field: "paymentDate", message: "A data do pagamento não pode ser anterior à criação do título." },
        ]);
      }
      // Encargos sobre o restante ANTES deste pagamento, cobrados por inteiro nele (sob a trava do documento).
      const charge = this.lateFees ? await this.lateFees.chargeFor(document, input.parcelId, paymentDate) : null;
      const fineCents = charge?.fineCents ?? 0;
      const interestCents = charge?.interestCents ?? 0;
      // Dispensa > encargos → 422 WAIVER_EXCEEDS_FEES (Payment), depois das checagens de parcela/documento.
      const payment = document.registerPayment({
        fineCents,
        interestCents,
        waivedCents,
        waiverReason,
        backdateReason,
        parcelId: input.parcelId,
        amountCents,
        method: input.method,
        paymentDate,
        reference,
        createdById: input.userId,
      });
      await this.payments.create(payment);
      await this.documents.update(document);
    });

    return this.detail.execute(input.documentId);
  }
}
