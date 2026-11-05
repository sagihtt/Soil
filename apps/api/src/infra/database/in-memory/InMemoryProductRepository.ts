import {
  CreateProductRecord,
  IProductRepository,
  UpdateProductRecord,
} from '../../../application/ports/IProductRepository.js';
import { Product } from '../../../domain/entities/Product.js';
import { Money } from '../../../domain/value-objects/Money.js';

export class InMemoryProductRepository implements IProductRepository {
  private readonly products: Product[] = [];
  private nextId = 1;

  public async findByIdAndCompany(id: number, companyId: number): Promise<Product | null> {
    return this.products.find((p) => p.id === id && p.companyId === companyId) ?? null;
  }

  public async listByCompanyAndCatalogIds(
    companyId: number,
    catalogIds: number[],
  ): Promise<Product[]> {
    const idSet = new Set(catalogIds);
    return this.products.filter(
      (p) => p.companyId === companyId && idSet.has(p.catalogId) && p.isAvailable,
    );
  }

  public async listByCompany(companyId: number): Promise<Product[]> {
    return this.products.filter((p) => p.companyId === companyId);
  }

  public async create(data: CreateProductRecord): Promise<Product> {
    const product = Product.create({
      id: this.nextId++,
      companyId: data.companyId,
      userId: data.userId,
      catalogId: data.catalogId,
      name: data.name,
      manufacturer: data.manufacturer,
      sku: data.sku,
      price: Money.fromPositiveCents(data.priceCents),
      isBestQuality: data.isBestQuality,
    });
    this.products.push(product);
    return product;
  }

  public async update(data: UpdateProductRecord): Promise<Product | null> {
    const idx = this.products.findIndex((p) => p.id === data.id && p.companyId === data.companyId);
    if (idx === -1) return null;
    const existing = this.products[idx]!;
    const updated = Product.create({
      id: existing.id,
      companyId: existing.companyId,
      userId: existing.userId,
      catalogId: data.catalogId,
      name: data.name,
      manufacturer: data.manufacturer,
      sku: data.sku,
      price: Money.fromPositiveCents(data.priceCents),
      isBestQuality: data.isBestQuality,
      isAvailable: existing.isAvailable,
    });
    this.products[idx] = updated;
    return updated;
  }

  public async deleteByIdAndCompany(id: number, companyId: number): Promise<boolean> {
    const idx = this.products.findIndex((p) => p.id === id && p.companyId === companyId);
    if (idx === -1) return false;
    this.products.splice(idx, 1);
    return true;
  }
}
