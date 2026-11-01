-- Dados da loja (carnê e recibo). Linha única; sem linha inicial: o ADMIN preenche nas configurações.
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "cnpj" VARCHAR(20) NOT NULL,
    "address" VARCHAR(250) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreSettings_single_row" CHECK ("id" = 'default')
);
