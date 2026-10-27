import type { FastifyInstance } from "fastify";
import { bpsToPercent } from "@shared/domain/percent";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { authorize } from "../../../../../shared/middleware/authorize";
import { NoopPriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { GetPricingSettingsUseCase } from "@pricing/application/useCases/GetPricingSettingsUseCase";
import { UpdatePricingSettingsUseCase } from "@pricing/application/useCases/UpdatePricingSettingsUseCase";
import { CreatePricingExpenseUseCase } from "@pricing/application/useCases/CreatePricingExpenseUseCase";
import { UpdatePricingExpenseUseCase } from "@pricing/application/useCases/UpdatePricingExpenseUseCase";
import { DeletePricingExpenseUseCase } from "@pricing/application/useCases/DeletePricingExpenseUseCase";
import { SetTargetMarginUseCase } from "@pricing/application/useCases/SetTargetMarginUseCase";
import { GetVariantPricingUseCase } from "@pricing/application/useCases/queries/GetVariantPricingUseCase";
import { SetSupplierSuggestedPriceUseCase } from "@pricing/application/useCases/commands/SetSupplierSuggestedPriceUseCase";
import { ApplyVariantPriceUseCase } from "@pricing/application/useCases/commands/ApplyVariantPriceUseCase";
import { PrismaVariantPricingReader } from "@pricing/infrastructure/prisma/PrismaVariantPricingReader";
import { PrismaVariantPricingWriter } from "@pricing/infrastructure/prisma/PrismaVariantPricingWriter";
import { PrismaTargetMarginReader } from "@pricing/infrastructure/prisma/PrismaTargetMarginReader";
import { toExpenseDTO } from "@pricing/application/dto/PricingSettingsDTO";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { PrismaPricingSettingsRepository } from "@pricing/infrastructure/prisma/PrismaPricingSettingsRepository";
import {
  applyPriceBodySchema,
  supplierPriceBodySchema,
  variantIdParamsSchema,
  expenseBodySchema,
  expenseIdParamsSchema,
  targetMarginBodySchema,
  targetMarginParamsSchema,
  updateSettingsSchema,
} from "@pricing/interfaces/http/schemas/pricingSchemas";

export async function pricingRoutes(app: FastifyInstance) {
  const tm = new PrismaTransactionManager();
  const repository = new PrismaPricingSettingsRepository();
  const reader = new PrismaPricingSettingsReader();
  // A Task 5 troca o no-op pela revisão real de preços.
  const trigger = new NoopPriceReviewTrigger();
  const price = { preHandler: [authorize("catalog.price")] };
  const manage = { preHandler: [authorize("pricing.manage")] };

  const get = new GetPricingSettingsUseCase(reader, repository, tm);
  const update = new UpdatePricingSettingsUseCase(repository, reader, trigger, tm);
  const createExpense = new CreatePricingExpenseUseCase(repository, reader, trigger, tm);
  const updateExpense = new UpdatePricingExpenseUseCase(repository, reader, trigger, tm);
  const deleteExpense = new DeletePricingExpenseUseCase(repository, trigger, tm);
  const variantReader = new PrismaVariantPricingReader();
  const variantWriter = new PrismaVariantPricingWriter();
  const getVariant = new GetVariantPricingUseCase(variantReader, reader, new PrismaTargetMarginReader(), tm);
  const setSupplier = new SetSupplierSuggestedPriceUseCase(variantWriter, getVariant, tm);
  const applyPrice = new ApplyVariantPriceUseCase(variantWriter, getVariant, trigger, tm);
  const setMargin = new SetTargetMarginUseCase(repository, reader, trigger, tm);

  app.get("/settings", manage, async (_request, reply) => reply.send(HttpResponse.ok(await get.execute())));

  app.put("/settings", manage, async (request, reply) => {
    const body = parseInput(updateSettingsSchema, request.body);
    const creditBps: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) creditBps[i] = (body.cardFees.creditPercent as Record<string, number>)[String(i)];
    const dto = await update.execute({
      defaultMarginBps: body.defaultMarginPercent,
      roundingStrategy: body.roundingStrategy,
      alertThresholdBps: body.alertThresholdPercent,
      cardFees: { debitBps: body.cardFees.debitPercent, creditBps },
      userId: request.user?.sub ?? null,
    });
    return reply.send(HttpResponse.ok(dto));
  });

  app.get("/expenses", manage, async (_request, reply) => {
    const list = await repository.listExpenses();
    return reply.send(HttpResponse.ok(list.map(toExpenseDTO)));
  });

  app.post("/expenses", manage, async (request, reply) => {
    const body = parseInput(expenseBodySchema, request.body);
    const dto = await createExpense.execute({ name: body.name, percentBps: body.percentBps, active: body.active });
    return reply.status(201).send(HttpResponse.created(dto));
  });

  app.put("/expenses/:id", manage, async (request, reply) => {
    const { id } = parseInput(expenseIdParamsSchema, request.params);
    const body = parseInput(expenseBodySchema, request.body);
    return reply.send(HttpResponse.ok(await updateExpense.execute({ id, ...body })));
  });

  app.delete("/expenses/:id", manage, async (request, reply) => {
    const { id } = parseInput(expenseIdParamsSchema, request.params);
    await deleteExpense.execute({ id });
    return reply.status(204).send();
  });

  app.put("/target-margins/:level/:id", manage, async (request, reply) => {
    const { level, id } = parseInput(targetMarginParamsSchema, request.params);
    const { targetMarginPercent } = parseInput(targetMarginBodySchema, request.body);
    const { marginBps } = await setMargin.execute({ level, id, marginBps: targetMarginPercent });
    return reply.send(HttpResponse.ok({ level, id, targetMarginPercent: marginBps === null ? null : bpsToPercent(marginBps) }));
  });

  app.get("/variants/:id", price, async (request, reply) => {
    const { id } = parseInput(variantIdParamsSchema, request.params);
    return reply.send(HttpResponse.ok(await getVariant.execute({ variantId: id })));
  });

  app.put("/variants/:id/supplier-price", price, async (request, reply) => {
    const { id } = parseInput(variantIdParamsSchema, request.params);
    const body = parseInput(supplierPriceBodySchema, request.body);
    return reply.send(HttpResponse.ok(await setSupplier.execute({ variantId: id, priceCents: body.supplierSuggestedPrice })));
  });

  app.post("/variants/:id/apply-price", price, async (request, reply) => {
    const { id } = parseInput(variantIdParamsSchema, request.params);
    const { source } = parseInput(applyPriceBodySchema, request.body);
    return reply.send(HttpResponse.ok(await applyPrice.execute({ variantId: id, source })));
  });
}
