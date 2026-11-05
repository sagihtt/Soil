import { QuoteProfile, QuoteStatus } from '@soil/shared';
import { DomainValidationError } from '../errors/DomainErrors.js';
import { Money } from '../value-objects/Money.js';

export interface QuoteItemProps {
  productId: number;
  productName: string;
  manufacturer: string;
  quantity: number;
  unitPrice: Money;
}

export class QuoteItem {
  public readonly productId: number;
  public readonly productName: string;
  public readonly manufacturer: string;
  public readonly quantity: number;
  public readonly unitPrice: Money;

  public constructor(props: QuoteItemProps) {
    if (!Number.isFinite(props.quantity) || props.quantity <= 0) {
      throw new DomainValidationError('A quantidade do item do orçamento deve ser maior que zero.');
    }
    this.productId = props.productId;
    this.productName = props.productName;
    this.manufacturer = props.manufacturer;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
  }

  public get subtotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
}

export class Quote {
  public readonly id: number;
  public readonly companyId: number;
  public readonly userId: number;
  public readonly vehicleId: number;
  private _clientId: number | null;
  private _profile: QuoteProfile;
  private _items: QuoteItem[];
  private _status: QuoteStatus;
  private _sentAt: Date | null;

  public constructor(params: {
    id: number;
    companyId: number;
    userId: number;
    vehicleId: number;
    clientId: number | null;
    profile: QuoteProfile;
    items: QuoteItem[];
    status?: QuoteStatus;
    sentAt?: Date | null;
  }) {
    if (params.items.length === 0) {
      throw new DomainValidationError('O orçamento deve possuir pelo menos um item.');
    }
    this.id = params.id;
    this.companyId = params.companyId;
    this.userId = params.userId;
    this.vehicleId = params.vehicleId;
    this._clientId = params.clientId;
    this._profile = params.profile;
    this._items = [...params.items];
    this._status = params.status ?? QuoteStatus.DRAFT;
    this._sentAt = params.sentAt ?? null;
  }

  public get clientId(): number | null {
    return this._clientId;
  }

  public get profile(): QuoteProfile {
    return this._profile;
  }

  public get items(): readonly QuoteItem[] {
    return this._items;
  }

  public get status(): QuoteStatus {
    return this._status;
  }

  public get sentAt(): Date | null {
    return this._sentAt;
  }

  public get totalAmount(): Money {
    return this._items.reduce((acc, item) => acc.add(item.subtotal), Money.zero());
  }

  public updateItems(items: QuoteItem[], profile: QuoteProfile, clientId: number | null): void {
    if (items.length === 0) {
      throw new DomainValidationError('O orçamento deve possuir pelo menos um item.');
    }
    this._items = [...items];
    this._profile = profile;
    this._clientId = clientId;
  }

  public markAsSent(at: Date = new Date()): void {
    this._status = QuoteStatus.SENT;
    this._sentAt = at;
  }
}
