import { DomainValidationError } from '../errors/DomainErrors.js';
import { Money } from '../value-objects/Money.js';

export interface ProductProps {
  id: number;
  companyId: number;
  userId: number;
  catalogId: number;
  name: string;
  manufacturer: string;
  sku: string | null;
  price: Money;
  isBestQuality: boolean;
  isAvailable: boolean;
}

export class Product {
  public readonly id: number;
  public readonly companyId: number;
  public readonly userId: number;
  public readonly catalogId: number;
  public readonly name: string;
  public readonly manufacturer: string;
  public readonly sku: string | null;
  public readonly price: Money;
  public readonly isBestQuality: boolean;
  public readonly isAvailable: boolean;

  private constructor(props: ProductProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.userId = props.userId;
    this.catalogId = props.catalogId;
    this.name = props.name;
    this.manufacturer = props.manufacturer;
    this.sku = props.sku;
    this.price = props.price;
    this.isBestQuality = props.isBestQuality;
    this.isAvailable = props.isAvailable;
  }

  public static create(params: {
    id: number;
    companyId: number;
    userId: number;
    catalogId: number;
    name: string;
    manufacturer: string;
    sku?: string | null;
    price: Money;
    isBestQuality?: boolean;
    isAvailable?: boolean;
  }): Product {
    const name = params.name.trim();
    const manufacturer = params.manufacturer.trim();

    if (!name || !manufacturer) {
      throw new DomainValidationError('Nome comercial e fabricante do produto são obrigatórios.');
    }

    return new Product({
      id: params.id,
      companyId: params.companyId,
      userId: params.userId,
      catalogId: params.catalogId,
      name,
      manufacturer,
      sku: params.sku?.trim() ?? null,
      price: params.price,
      isBestQuality: params.isBestQuality ?? false,
      isAvailable: params.isAvailable ?? true,
    });
  }
}
