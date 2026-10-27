-- Pedidos de cancelamento de venda: o vendedor pede, o ADMIN aprova ou recusa. Aditivo.
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "SaleCancelRequest" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" VARCHAR(200),

    CONSTRAINT "SaleCancelRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SaleCancelRequest" ADD CONSTRAINT "SaleCancelRequest_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleCancelRequest" ADD CONSTRAINT "SaleCancelRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleCancelRequest" ADD CONSTRAINT "SaleCancelRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Um pedido em aberto por venda.
CREATE UNIQUE INDEX "SaleCancelRequest_pending_sale_key" ON "SaleCancelRequest"("saleId") WHERE "status" = 'PENDING';
CREATE INDEX "SaleCancelRequest_status_requestedAt_idx" ON "SaleCancelRequest"("status", "requestedAt");
