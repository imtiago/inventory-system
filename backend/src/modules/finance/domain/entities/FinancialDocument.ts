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

  get id() {
    return this._id;
  }

  get type() {
    return this._type;
  }

  get referenceId() {
    return this._referenceId;
  }

  get customerId() {
    return this._customerId;
  }

  get supplierId() {
    return this._supplierId;
  }

  get createdAt() {
    return this._createdAt;
  }

  get parcels() {
    return this._parcels;
  }

  get totalAmount() {
    return this._parcels.reduce((total, parcel) => total + parcel.amount, 0);
  }

  addParcel(parcel: FinancialParcel) {
    this._parcels.push(parcel);
  }
}
