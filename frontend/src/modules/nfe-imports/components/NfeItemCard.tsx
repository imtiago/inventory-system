import { ProductPicker } from './ProductPicker';
import { useProductVariantOptions } from '@/modules/inventory/hooks/useProductVariantOptions';
import { useBrands } from '@/modules/brands/hooks/useBrands';
import { useCategories } from '@/modules/categories/hooks/useCategories';
import { formatCurrency } from '@/shared/utils/money';
import { MONEY_DECIMALS_MESSAGE, moneyTextError } from '@/shared/utils/money';
import { MoneyInput, QuantityInput } from '@/shared/components/form';
import { isValidSalePrice, parseUnitsPerPackage, unitsOf, type ItemDraft, type ItemMode } from '../utils/review';
import type { INfeItem } from '../types';

const inputClass = 'w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2 text-sm';

const MODE_LABELS: Record<ItemMode, string> = {
  link: 'Vincular a variante existente',
  createProduct: 'Criar produto',
  createVariant: 'Criar variante em produto existente',
};

interface Props {
  item: INfeItem;
  draft: ItemDraft;
  disabled: boolean;
  /** Server error attributed to this item (shown once, here). */
  serverError?: string;
  onChange: (patch: Partial<ItemDraft>) => void;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function VariantSelect({ item, productId, value, onChange, disabled }: { item: INfeItem; productId: string; value: string; onChange: (id: string, label: string) => void; disabled: boolean }) {
  const { variants, isLoading, error } = useProductVariantOptions(productId);

  return (
    <Field id={`variant-${item.index}`} label={`Variante do item ${item.index}`}>
      <select
        id={`variant-${item.index}`}
        value={value}
        disabled={disabled || isLoading}
        onChange={(event) => {
          const variant = variants.find((v) => v.id === event.target.value);
          if (variant) onChange(variant.id, `${variant.name} (${variant.code})`);
        }}
        className={inputClass}
      >
        <option value="">{isLoading ? 'Carregando...' : 'Escolha a variante'}</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.name} ({variant.code}){variant.barcode ? ` · ${variant.barcode}` : ''}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </Field>
  );
}

export function NfeItemCard({ item, draft, disabled, serverError, onChange }: Props) {
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const n = item.index;
  const upp = parseUnitsPerPackage(draft.unitsPerPackage);
  const units = upp === null ? null : unitsOf(item.quantity, upp);
  const isSuggested = Boolean(item.suggestion) && draft.mode === 'link' && draft.variant?.id === item.suggestion?.productVariantId;

  return (
    <li data-testid={`nfe-item-${n}`} className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {n}. {item.name}
          </p>
          <p className="text-xs text-muted">
            Cód. {item.supplierCode}
            {item.barcode ? ` · ${item.barcode}` : ''} · {item.quantity} {item.unit} · custo {formatCurrency(item.total)}
          </p>
          {item.lots.length > 0 && <p className="text-xs text-muted">Lotes: {item.lots.map((lot) => `${lot.batchNumber} (${lot.quantity})`).join(', ')}</p>}
        </div>
        <div className="text-sm">
          <span className="text-muted">Quantidade em unidades: </span>
          <strong data-testid={`item-units-${n}`}>{units === null ? '—' : units}</strong>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field id={`mode-${n}`} label={`Ação do item ${n}`}>
          <select
            id={`mode-${n}`}
            aria-label={`Ação do item ${n}`}
            value={draft.mode ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ mode: (event.target.value || null) as ItemMode | null })}
            className={inputClass}
          >
            <option value="">Escolha...</option>
            {(Object.keys(MODE_LABELS) as ItemMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </Field>

        <Field id={`upp-${n}`} label={`Unidades por embalagem do item ${n}`}>
          <QuantityInput
            id={`upp-${n}`}
            itemName={`item ${n}`}
            value={draft.unitsPerPackage}
            disabled={disabled}
            aria-invalid={upp === null ? 'true' : undefined}
            onChange={(value) => onChange({ unitsPerPackage: value })}
          />
        </Field>
      </div>

      {draft.mode === 'link' && (
        <div className="mt-3 space-y-3">
          {draft.variant && (
            <p className="text-sm">
              <span className="text-muted">Vincular a </span>
              <span className="font-medium">{draft.variant.label}</span>
              {isSuggested && <span className="ml-2 rounded-lg bg-info-soft px-2 py-0.5 text-xs text-info">{item.suggestion?.source === 'MAPPING' ? 'sugerido por mapeamento' : 'sugerido por código de barras'}</span>}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <ProductPicker itemIndex={n} value={draft.product?.id ?? null} onChange={(product) => onChange({ product: product ? { id: product.id, label: product.name } : null, variant: null })} />
            {draft.product && (
              <VariantSelect item={item} productId={draft.product.id} value={draft.variant?.id ?? ''} disabled={disabled} onChange={(id, label) => onChange({ variant: { id, label: `${draft.product?.label} — ${label}` } })} />
            )}
          </div>
        </div>
      )}

      {draft.mode === 'createVariant' && (
        <div className="mt-3">
          <ProductPicker itemIndex={n} value={draft.product?.id ?? null} onChange={(product) => onChange({ product: product ? { id: product.id, label: product.name } : null })} />
        </div>
      )}

      {draft.mode === 'createProduct' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field id={`pname-${n}`} label={`Nome do produto do item ${n}`}>
            <input id={`pname-${n}`} value={draft.newProductName} disabled={disabled} onChange={(event) => onChange({ newProductName: event.target.value })} className={inputClass} />
          </Field>
          <Field id={`brand-${n}`} label={`Marca do item ${n}`}>
            <select id={`brand-${n}`} value={draft.brandId} disabled={disabled} onChange={(event) => onChange({ brandId: event.target.value })} className={inputClass}>
              <option value="">Escolha a marca</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`category-${n}`} label={`Categoria do item ${n}`}>
            <select id={`category-${n}`} value={draft.categoryId} disabled={disabled} onChange={(event) => onChange({ categoryId: event.target.value })} className={inputClass}>
              <option value="">Escolha a categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {(draft.mode === 'createProduct' || draft.mode === 'createVariant') && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field id={`vname-${n}`} label={`Nome da variante do item ${n}`}>
            <input id={`vname-${n}`} value={draft.variantName} disabled={disabled} onChange={(event) => onChange({ variantName: event.target.value })} className={inputClass} />
          </Field>
          <Field id={`barcode-${n}`} label={`Código de barras do item ${n}`}>
            <input id={`barcode-${n}`} value={draft.barcode} disabled={disabled} inputMode="numeric" onChange={(event) => onChange({ barcode: event.target.value })} className={inputClass} />
          </Field>
          <Field id={`price-${n}`} label={`Preço de venda do item ${n}`}>
            <MoneyInput
              id={`price-${n}`}
              value={draft.salePrice}
              disabled={disabled}
              aria-invalid={draft.salePrice !== '' && !isValidSalePrice(draft.salePrice) ? 'true' : undefined}
              onChange={(event) => onChange({ salePrice: event.target.value })}
            />
            {moneyTextError(draft.salePrice) === MONEY_DECIMALS_MESSAGE && <p className="mt-1 text-xs text-danger">Use no máximo 2 casas decimais.</p>}
          </Field>
        </div>
      )}

      {upp !== null && units === null && (
        <p role="alert" className="mt-3 text-sm text-danger">
          A quantidade ({item.quantity}) x {upp} não resulta em unidades inteiras. Ajuste as unidades por embalagem.
        </p>
      )}
      {serverError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {serverError}
        </p>
      )}
    </li>
  );
}
