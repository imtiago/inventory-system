export interface PaymentDTO {
  id: string;

  amount: number;

  method: string;

  reference: string | null;

  paymentDate: Date;
}
