import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  CreateProductRecord,
  IProductRepository,
  UpdateProductRecord,
} from '../../../application/ports/IProductRepository.js';
import { Product } from '../../../domain/entities/Product.js';
import { Money } from '../../../domain/value-objects/Money.js';

interface ProductRow extends RowDataPacket {
  id: number;
  company_id: number;
  user_id: number;
  catalog_id: number;
  name: string;
  manufacturer: string;
  sku: string | null;
  price_cents: number;
  is_best_quality: number | boolean;
  is_available: number | boolean;
}

export class MysqlProductRepository implements IProductRepository {
  public constructor(private readonly pool: Pool) {}

  private mapRow(row: ProductRow): Product {
    return Product.create({
      id: row.id,
      companyId: row.company_id,
      userId: row.user_id,
      catalogId: row.catalog_id,
      name: row.name,
      manufacturer: row.manufacturer,
      sku: row.sku,
      price: Money.fromPositiveCents(row.price_cents),
      isBestQuality: Boolean(row.is_best_quality),
      isAvailable: Boolean(row.is_available),
    });
  }

  public async findByIdAndCompany(id: number, companyId: number): Promise<Product | null> {
    const [rows] = await this.pool.execute<ProductRow[]>(
      'SELECT id, company_id, user_id, catalog_id, name, manufacturer, sku, price_cents, is_best_quality, is_available FROM product WHERE id = ? AND company_id = ? LIMIT 1',
      [id, companyId],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async listByCompanyAndCatalogIds(
    companyId: number,
    catalogIds: number[],
  ): Promise<Product[]> {
    if (catalogIds.length === 0) return [];
    const placeholders = catalogIds.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<ProductRow[]>(
      `SELECT id, company_id, user_id, catalog_id, name, manufacturer, sku, price_cents, is_best_quality, is_available
       FROM product
       WHERE company_id = ? AND is_available = TRUE AND catalog_id IN (${placeholders})
       ORDER BY price_cents ASC`,
      [companyId, ...catalogIds],
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async listByCompany(companyId: number): Promise<Product[]> {
    const [rows] = await this.pool.execute<ProductRow[]>(
      'SELECT id, company_id, user_id, catalog_id, name, manufacturer, sku, price_cents, is_best_quality, is_available FROM product WHERE company_id = ? ORDER BY name ASC',
      [companyId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async create(data: CreateProductRecord): Promise<Product> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO product (company_id, user_id, catalog_id, name, manufacturer, sku, price_cents, is_best_quality, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
      [
        data.companyId,
        data.userId,
        data.catalogId,
        data.name,
        data.manufacturer,
        data.sku,
        data.priceCents,
        data.isBestQuality,
      ],
    );

    return Product.create({
      id: result.insertId,
      companyId: data.companyId,
      userId: data.userId,
      catalogId: data.catalogId,
      name: data.name,
      manufacturer: data.manufacturer,
      sku: data.sku,
      price: Money.fromPositiveCents(data.priceCents),
      isBestQuality: data.isBestQuality,
      isAvailable: true,
    });
  }

  public async update(data: UpdateProductRecord): Promise<Product | null> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE product
       SET catalog_id = ?, name = ?, manufacturer = ?, sku = ?, price_cents = ?, is_best_quality = ?
       WHERE id = ? AND company_id = ?`,
      [
        data.catalogId,
        data.name,
        data.manufacturer,
        data.sku,
        data.priceCents,
        data.isBestQuality,
        data.id,
        data.companyId,
      ],
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return this.findByIdAndCompany(data.id, data.companyId);
  }

  public async deleteByIdAndCompany(id: number, companyId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM product WHERE id = ? AND company_id = ?',
      [id, companyId],
    );
    return result.affectedRows > 0;
  }
}
