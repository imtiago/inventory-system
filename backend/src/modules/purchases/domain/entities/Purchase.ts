// domain/entities/Purchase.ts

import { PurchaseItem } from "./PurchaseItem";
import { PurchaseOrigin } from "../enums/PurchaseOrigin";
import { PurchaseStatus } from "../enums/PurchaseStatus";

export interface PurchaseProps {
  id?: string;

  supplierId: string;

  supplierName: string;

  origin: PurchaseOrigin;

  purchaseDate?: Date;

  status?: PurchaseStatus;

  items?: PurchaseItem[];

  createdAt?: Date;

  updatedAt?: Date;
}

export class Purchase {
  public readonly id?: string;

  public readonly supplierId: string;

  public readonly supplierName: string;

  public readonly origin: PurchaseOrigin;

  private status: PurchaseStatus;

  private readonly items: PurchaseItem[];

  public readonly purchaseDate: Date;

  public readonly createdAt: Date;

  public updatedAt: Date;

  constructor(props: PurchaseProps) {
    this.id = props.id;

    this.supplierId = props.supplierId;

    this.supplierName = props.supplierName;

    this.origin = props.origin;

    this.status = props.status ?? PurchaseStatus.DRAFT;

    this.items = props.items ?? [];

    this.purchaseDate = props.purchaseDate ?? new Date();

    this.createdAt = props.createdAt ?? new Date();

    this.updatedAt = props.updatedAt ?? new Date();
  }

  public addItem(item: PurchaseItem): void {
    const existing = this.items.find(
      (i) => i.productVariantId === item.productVariantId,
    );

    if (existing) {
      throw new Error("Variant already exists.");
    }

    this.items.push(item);

    this.updatedAt = new Date();
  }

  public removeItem(productVariantId: string): void {
    const index = this.items.findIndex(
      (item) => item.productVariantId === productVariantId,
    );

    if (index === -1) {
      throw new Error("Item not found.");
    }

    this.items.splice(index, 1);

    this.updatedAt = new Date();
  }

  public getItems(): readonly PurchaseItem[] {
    return this.items;
  }

  public getStatus(): PurchaseStatus {
    return this.status;
  }

  public getTotal(): number {
    return this.items.reduce((total, item) => total + item.getTotal(), 0);
  }

  public finish(): void {
    if (this.items.length === 0) {
      throw new Error("Purchase has no items.");
    }

    this.status = PurchaseStatus.COMPLETED;

    this.updatedAt = new Date();
  }

  public cancel(): void {
    if (this.status === PurchaseStatus.COMPLETED) {
      throw new Error("Completed purchase cannot be canceled.");
    }

    this.status = PurchaseStatus.CANCELED;

    this.updatedAt = new Date();
  }
}
