import { Product } from '../../domain/entities/Product.js';

export interface CreateProductRecord {
  companyId: number;
  userId: number;
  catalogId: number;
  name: string;
  manufacturer: string;
  sku: string | null;
  priceCents: number;
  isBestQuality: boolean;
}

export interface UpdateProductRecord {
  id: number;
  companyId: number;
  catalogId: number;
  name: string;
  manufacturer: string;
  sku: string | null;
  priceCents: number;
  isBestQuality: boolean;
}

export interface IProductRepository {
  findByIdAndCompany(id: number, companyId: number): Promise<Product | null>;
  listByCompanyAndCatalogIds(companyId: number, catalogIds: number[]): Promise<Product[]>;
  listByCompany(companyId: number): Promise<Product[]>;
  create(data: CreateProductRecord): Promise<Product>;
  update(data: UpdateProductRecord): Promise<Product | null>;
  deleteByIdAndCompany(id: number, companyId: number): Promise<boolean>;
}
