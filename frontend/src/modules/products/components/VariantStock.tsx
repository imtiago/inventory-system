import type { InventoryBalance } from "@/modules/inventory/services/inventoryService";

interface Props {
  /** Absent when the variant has no inventory row yet. */
  balance?: InventoryBalance;
  loading: boolean;
  error: boolean;
}

export function VariantStock({ balance, loading, error }: Props) {
  if (loading) {
    return (
      <span role="status" aria-label="Carregando estoque">
        ...
      </span>
    );
  }

  if (error) {
    return <span className="text-danger">Erro ao carregar estoque</span>;
  }

  if (!balance) {
    return <span className="text-subtle">Sem estoque</span>;
  }

  return (
    <div className="text-sm">
      <p className="font-medium">{balance.available}</p>

      <p className="text-muted">Disp.</p>

      {balance.expired > 0 && <p className="font-medium text-danger">Vencido: {balance.expired}</p>}
    </div>
  );
}
