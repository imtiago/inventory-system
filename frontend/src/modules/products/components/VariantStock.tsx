import { useVariantInventory } from "@/modules/inventory/hooks/useVariantInventory";

interface Props {
  variantId: string;
}

export function VariantStock({ variantId }: Props) {
  const { inventory, loading, error } = useVariantInventory(variantId);

  if (loading) {
    return <span>...</span>;
  }

  if (error) {
    return <span className="text-red-600">Erro ao carregar estoque</span>;
  }

  if (!inventory) {
    return <span className="text-gray-400">Sem estoque</span>;
  }

  return (
    <div className="text-sm">
      <p className="font-medium">{inventory.availableQuantity}</p>

      <p className="text-gray-500">Disp.</p>
    </div>
  );
}
