import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyTestDatabaseGuard } from "../test/testDatabase";

// Testes nunca usam o banco de desenvolvimento, mesmo rodando um arquivo isolado.
applyTestDatabaseGuard(process.env);

export const prisma = new PrismaClient();
