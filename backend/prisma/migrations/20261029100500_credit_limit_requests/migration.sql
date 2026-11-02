-- Pedidos de aumento de limite de crédito (vendedor pede, aprovador decide; ou aprovação automática). Aditivo.
CREATE TABLE "CreditLimitRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currentLimit" DECIMAL(12,2) NOT NULL,
    "requestedLimit" DECIMAL(12,2) NOT NULL,
    "approvedLimit" DECIMAL(12,2),
    "reason" VARCHAR(300) NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" VARCHAR(300),

    CONSTRAINT "CreditLimitRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditLimitRequest_amounts_check" CHECK (
        "currentLimit" >= 0 AND "requestedLimit" > 0 AND ("approvedLimit" IS NULL OR "approvedLimit" > 0)
    ),
    CONSTRAINT "CreditLimitRequest_decision_check" CHECK (
        ("status" = 'PENDING') = ("decidedAt" IS NULL)
        AND (("status" = 'APPROVED') = ("approvedLimit" IS NOT NULL))
    )
);

ALTER TABLE "CreditLimitRequest" ADD CONSTRAINT "CreditLimitRequest_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditLimitRequest" ADD CONSTRAINT "CreditLimitRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditLimitRequest" ADD CONSTRAINT "CreditLimitRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Um pedido em aberto por cliente.
CREATE UNIQUE INDEX "CreditLimitRequest_pending_customer_key" ON "CreditLimitRequest"("customerId") WHERE "status" = 'PENDING';
CREATE INDEX "CreditLimitRequest_status_requestedAt_idx" ON "CreditLimitRequest"("status", "requestedAt");
CREATE INDEX "CreditLimitRequest_customerId_requestedAt_idx" ON "CreditLimitRequest"("customerId", "requestedAt");
