import { v4 as uuid } from "uuid";
import { SaleStatus } from "@prisma/client";
import { SaleItem } from "./SaleItem";

// src/modules/sales/domain/entities/Sale.ts
export class Sale {
  id: string;
  customerId: string;
  items: SaleItem[];
  totalAmount: number;
  createdAt: Date;
  status: SaleStatus;

  constructor(props: {
    id?: string;
    customerId: string;
    items?: SaleItem[];
    totalAmount?: number;
    createdAt?: Date;
    status?: SaleStatus;
  }) {
    this.id = props.id ?? uuid();
    this.customerId = props.customerId;
    this.items = props.items ?? [];
    this.totalAmount = props.totalAmount ?? 0;
    this.createdAt = props.createdAt ?? new Date();
    this.status = props.status ?? SaleStatus.PENDING; // padrão
  }

  addItem(item: SaleItem) {
    this.items.push(item);
    this.recalculateTotal();
  }

  recalculateTotal() {
    this.totalAmount = this.items.reduce((sum, i) => sum + i.totalPrice(), 0);
  }

  markAsCompleted() {
    this.status = SaleStatus.COMPLETED;
  }

  markAsCancelled() {
    this.status = SaleStatus.CANCELLED;
  }
}
