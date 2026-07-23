export function makeFinancialService() {
  const repository = new PrismaReceivableRepository();

  const createReceivable = new CreateReceivable(repository);

  return new FinancialApplicationService(createReceivable);
}
