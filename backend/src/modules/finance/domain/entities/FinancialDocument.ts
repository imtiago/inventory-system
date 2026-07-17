import { v4 as uuid } from "uuid";
import { FinancialType } from "../enums/FinancialType";
import { FinancialParcel } from "./FinancialParcel";

export class FinancialDocument {
  private _id: string;
  private _type: FinancialType;

  private _referenceId: string;

  private _customerId: string | null;
  private _supplierId: string | null;

  private _createdAt: Date;

  private _parcels: FinancialParcel[];

  constructor(props: {
    id?: string;
    type: FinancialType;
    referenceId: string;

    customerId?: string | null;
    supplierId?: string | null;

    createdAt?: Date;

    parcels?: FinancialParcel[];
  }) {
    this._id = props.id ?? uuid();

    this._type = props.type;

    this._referenceId = props.referenceId;

    this._customerId = props.customerId ?? null;

    this._supplierId = props.supplierId ?? null;

    this._createdAt = props.createdAt ?? new Date();

    this._parcels = props.parcels ?? [];
  }

  get id(): string {
    return this._id;
  }

  get type(): FinancialType {
    return this._type;
  }

  get referenceId(): string {
    return this._referenceId;
  }

  get customerId(): string | null {
    return this._customerId;
  }

  get supplierId(): string | null {
    return this._supplierId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get parcels(): FinancialParcel[] {
    return this._parcels;
  }

  get totalAmount(): number {
    return this._parcels.reduce((total, parcel) => total + parcel.amount, 0);
  }

  addParcel(parcel: FinancialParcel): void {
    this._parcels.push(parcel);
  }
}
