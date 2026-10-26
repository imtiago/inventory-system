import type { Bps } from "@shared/domain/percent";

export interface TargetMarginLevels {
  variant: Bps | null;
  product: Bps | null;
  category: Bps | null;
}

export interface TargetMarginReader {
  forVariant(variantId: string): Promise<TargetMarginLevels>;
}
