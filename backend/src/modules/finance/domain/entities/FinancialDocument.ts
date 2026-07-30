import { FinancialType } from "../enums/FinancialType";
import { FinancialParcel } from "./FinancialParcel";
import { FinancialStatus } from "../enums/FinancialStatus";
import { FinancialPartyType } from "../enums/FinancialPartyType";
import { FinancialOriginType } from "../enums/FinancialOriginType";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class FinancialDocument extends BaseEntity {
  private _type: FinancialType;
  private _originId: string;
  private _originType: FinancialOriginType;

  private _partyId: string;
  private _partyType: FinancialPartyType;

  private _status: FinancialStatus;

  private _parcels: FinancialParcel[];

  constructor(props: {
    id?: string;
    type: FinancialType;
    originId: string;
    originType: FinancialOriginType;

    status?: FinancialStatus;

    partyId: string;
    partyType: FinancialPartyType;

    createdAt?: Date;

    parcels?: FinancialParcel[];
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._type = props.type;

    this._originId = props.originId;
    this._originType = props.originType;

    this._partyId = props.partyId;

    this._partyType = props.partyType;

    this._parcels = props.parcels ?? [];

    this._status = props.status ?? FinancialStatus.OPEN;
  }

  get type(): FinancialType {
    return this._type;
  }

  get partyId(): string {
    return this._partyId;
  }

  get partyType(): FinancialPartyType {
    return this._partyType;
  }

  get parcels(): FinancialParcel[] {
    return this._parcels;
  }

  get totalAmount(): number {
    return this._parcels.reduce((total, parcel) => total + parcel.amount, 0);
  }

  get status(): FinancialStatus {
    return this._status;
  }
  get originId(): string {
    return this._originId;
  }
  get originType(): FinancialOriginType {
    return this._originType;
  }

  addParcel(parcel: FinancialParcel): void {
    this._parcels.push(parcel);
  }
}
