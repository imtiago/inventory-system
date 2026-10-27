import type { FastifyInstance } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { authorize } from "../../../../../shared/middleware/authorize";
import { parseInput } from "@shared/http/parseInput";
import { toCents } from "@shared/domain/money";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaCreditSettingsRepository } from "@credit/infrastructure/prisma/PrismaCreditSettingsRepository";
import { PrismaCreditProfileRepository } from "@credit/infrastructure/prisma/PrismaCreditProfileRepository";
import { PrismaCreditActivationChecks } from "@credit/infrastructure/prisma/PrismaCreditActivationChecks";
import { GetCreditSettingsUseCase } from "@credit/application/useCases/GetCreditSettingsUseCase";
import { UpdateCreditSettingsUseCase } from "@credit/application/useCases/UpdateCreditSettingsUseCase";
import { ListCreditProfilesUseCase, UpdateCreditProfileUseCase } from "@credit/application/useCases/CreditProfileUseCases";
import {
  creditProfileParamsSchema,
  updateCreditProfileSchema,
  updateCreditSettingsSchema,
} from "@credit/interfaces/http/schemas/creditSchemas";

export async function creditRoutes(app: FastifyInstance) {
  const tm = new PrismaTransactionManager();
  const settings = new PrismaCreditSettingsRepository();
  const profiles = new PrismaCreditProfileRepository();
  const getSettings = new GetCreditSettingsUseCase(settings);
  const updateSettings = new UpdateCreditSettingsUseCase(settings, new PrismaCreditActivationChecks(), tm);
  const listProfiles = new ListCreditProfilesUseCase(profiles);
  const updateProfile = new UpdateCreditProfileUseCase(profiles, tm);
  const manage = { preHandler: [authorize("credit.manage")] };

  app.get("/settings", manage, async (_request, reply) => reply.send(HttpResponse.ok(await getSettings.execute())));

  app.put("/settings", manage, async (request, reply) => {
    const body = parseInput(updateCreditSettingsSchema, request.body);
    const dto = await updateSettings.execute({
      crediarioEnabled: body.crediarioEnabled,
      rules: body.rules,
      userId: request.user?.sub ?? null,
    });
    return reply.send(HttpResponse.ok(dto));
  });

  // Perfis: leitura para quem vê clientes (tela da ficha/venda); edição só ADMIN.
  app.get("/profiles", { preHandler: [authorize("customers.read")] }, async (_request, reply) =>
    reply.send(HttpResponse.ok(await listProfiles.execute())),
  );

  app.put("/profiles/:code", manage, async (request, reply) => {
    const { code } = parseInput(creditProfileParamsSchema, request.params);
    const body = parseInput(updateCreditProfileSchema, request.body);
    const dto = await updateProfile.execute({
      code,
      initialLimitCents: toCents(body.initialLimit),
      minDownPaymentBps: body.minDownPaymentPercent,
      maxInstallments: body.maxInstallments,
    });
    return reply.send(HttpResponse.ok(dto));
  });

  // Quem pode aprovar crédito (ADMIN ou marcado), para o seletor do modal de autorização.
  app.get("/approvers", { preHandler: [authorize("sales.create")] }, async (_request, reply) => {
    const users = await getDb().user.findMany({
      where: { active: true, OR: [{ role: "ADMIN" }, { canApproveCredit: true }] },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return reply.send(HttpResponse.ok(users));
  });

  // Sonda de `credit.approve`: 200 só para quem pode aprovar.
  app.get("/approvers/me", { preHandler: [authorize("credit.approve")] }, async (_request, reply) =>
    reply.send(HttpResponse.ok({ canApprove: true })),
  );
}
