import { useVariantInventory } from "@/modules/inventory/hooks/useVariantInventory";

interface Props {
  variantId: string;
}

export function VariantStock({ variantId }: Props) {
  const { data, isLoading } = useVariantInventory(variantId);

  if (isLoading) {
    return <span>...</span>;
  }

  if (!data) {
    return <span className="text-gray-400">Sem estoque</span>;
  }

  return (
    <div className="text-sm">
      <p className="font-medium">{data.availableQuantity}</p>

      <p className="text-gray-500">Disp.</p>
    </div>
  );
}
