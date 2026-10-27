import { hasPermission, Permission } from "@shared/auth/permissions";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { DashboardReadRepository } from "../../contracts/DashboardReadRepository";
import { DashboardDTO } from "../../dto/DashboardDTO";

type SectionKey = Exclude<keyof DashboardDTO, "generatedAt">;

const SECTION_PERMISSIONS: Record<SectionKey, Permission> = {
  sales: "sales.read",
  receivables: "finance.read",
  payables: "payables.read",
  inventory: "inventory.read",
  purchases: "purchases.read",
  profit: "reports.profit",
  pricing: "catalog.price",
};

export class GetDashboardUseCase {
  constructor(private readonly repository: DashboardReadRepository) {}

  /** Só calcula as seções permitidas ao papel; `now` injetável para testes. */
  async execute(role: string, now: Date = new Date()): Promise<DashboardDTO> {
    const today = todayInBusinessTz(now);
    const allowed = (key: SectionKey) => hasPermission(role, SECTION_PERMISSIONS[key]);
    const when = <T>(key: SectionKey, load: () => Promise<T>): Promise<T | undefined> =>
      allowed(key) ? load() : Promise.resolve(undefined);

    // Em sequência: seções em paralelo ocupariam uma conexão do pool cada (até cinco por requisição).
    const sales = await when("sales", () => this.repository.sales(today));
    const receivables = await when("receivables", () => this.repository.receivables(today));
    const payables = await when("payables", () => this.repository.payables(today));
    const inventory = await when("inventory", () => this.repository.inventory(today));
    const purchases = await when("purchases", () => this.repository.purchases());
    const profit = await when("profit", () => this.repository.profit(today));

    const pricing = await when("pricing", () => this.repository.pricing());

    const dto: DashboardDTO = { generatedAt: now.toISOString() };
    if (sales) dto.sales = sales;
    if (receivables) dto.receivables = receivables;
    if (payables) dto.payables = payables;
    if (inventory) dto.inventory = inventory;
    if (purchases) dto.purchases = purchases;
    if (profit) dto.profit = profit;
    if (pricing) dto.pricing = pricing;
    return dto;
  }
}
