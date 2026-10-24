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
};

export class GetDashboardUseCase {
  constructor(private readonly repository: DashboardReadRepository) {}

  /** Só calcula as seções permitidas ao papel; `now` injetável para testes. */
  async execute(role: string, now: Date = new Date()): Promise<DashboardDTO> {
    const today = todayInBusinessTz(now);
    const allowed = (key: SectionKey) => hasPermission(role, SECTION_PERMISSIONS[key]);
    const when = <T>(key: SectionKey, load: () => Promise<T>): Promise<T | undefined> =>
      allowed(key) ? load() : Promise.resolve(undefined);

    const [sales, receivables, payables, inventory, purchases] = await Promise.all([
      when("sales", () => this.repository.sales(today)),
      when("receivables", () => this.repository.receivables(today)),
      when("payables", () => this.repository.payables(today)),
      when("inventory", () => this.repository.inventory(today)),
      when("purchases", () => this.repository.purchases()),
    ]);

    const dto: DashboardDTO = { generatedAt: now.toISOString() };
    if (sales) dto.sales = sales;
    if (receivables) dto.receivables = receivables;
    if (payables) dto.payables = payables;
    if (inventory) dto.inventory = inventory;
    if (purchases) dto.purchases = purchases;
    return dto;
  }
}
