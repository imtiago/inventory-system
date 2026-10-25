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
    return <span className="text-red-600">Erro ao carregar estoque</span>;
  }

  if (!balance) {
    return <span className="text-gray-400">Sem estoque</span>;
  }

  return (
    <div className="text-sm">
      <p className="font-medium">{balance.available}</p>

      <p className="text-gray-500">Disp.</p>
    </div>
  );
}
