import { BusinessRuleError } from "@shared/domain/errors";
// src/modules/catalog/domain/entities/ProductVariant.ts

import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class ProductVariant extends BaseEntity {
  private _productId: string;

  private _code: string;

  private _name: string;

  private _barcode: string | null;

  private _salePrice: number;

  constructor(props: {
    id?: string;
    productId: string;
    code: string;
    name?: string;
    barcode?: string | null;
    salePrice?: number;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    if (!props.productId.trim()) {
      throw new BusinessRuleError("O produto é obrigatório.", "PRODUCT_ID_REQUIRED");
    }

    if (!props.code.trim()) {
      throw new BusinessRuleError("O código da variante é obrigatório.", "VARIANT_CODE_REQUIRED");
    }

    if (props.name !== undefined && !props.name.trim()) {
      throw new BusinessRuleError("O nome da variante não pode ser vazio.", "VARIANT_NAME_REQUIRED");
    }

    if (props.salePrice !== undefined && props.salePrice < 0) {
      throw new BusinessRuleError("O preço de venda não pode ser negativo.", "NEGATIVE_SALE_PRICE");
    }

    this._productId = props.productId;

    this._code = props.code;

    this._name = props.name ?? "Padrão";

    this._barcode = props.barcode ?? null;

    this._salePrice = props.salePrice ?? 0;
  }

  get productId(): string {
    return this._productId;
  }

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get barcode(): string | null {
    return this._barcode;
  }

  get salePrice(): number {
    return this._salePrice;
  }

  rename(name: string): void {
    if (!name.trim()) {
      throw new BusinessRuleError("O nome da variante não pode ser vazio.", "VARIANT_NAME_REQUIRED");
    }

    this._name = name;
  }

  changeBarcode(barcode: string | null): void {
    this._barcode = barcode;
  }

  changeSalePrice(price: number): void {
    if (price < 0) {
      throw new BusinessRuleError("O preço de venda não pode ser negativo.", "NEGATIVE_SALE_PRICE");
    }

    this._salePrice = price;
  }
}
