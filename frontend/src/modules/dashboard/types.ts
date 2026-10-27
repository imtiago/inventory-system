export interface IDashboardDay {
  date: string;
  count: number;
  total: number;
}

export interface IDashboardFinance {
  open: number;
  overdue: number;
  dueNext7Days: { count: number; amount: number };
}

export interface IDashboard {
  generatedAt: string;
  sales?: {
    today: { count: number; total: number };
    month: { count: number; total: number };
    last7Days: IDashboardDay[];
    topVariants: { productVariantId: string; label: string; quantity: number; total: number }[];
  };
  receivables?: IDashboardFinance;
  payables?: IDashboardFinance;
  inventory?: {
    outOfStockCount: number;
    outOfStock: { productVariantId: string; label: string; quantity: number }[];
    expiringLots: {
      count: number;
      items: { lotId: string; batchNumber: string | null; label: string; expirationDate: string; remainingQuantity: number }[];
    };
  };
  purchases?: { awaitingReceipt: { count: number; total: number } };
  profit?: { month: { revenue: number; profit: number; marginPercent: number | null; itemsWithoutCost: number } };
  pricing?: { pendingReviews: number };
}
