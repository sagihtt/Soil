import { CatalogCategory, CatalogSubtype } from '@soil/shared';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  AssignTechSpecRecord,
  CreateCatalogItemRecord,
  ICatalogRepository,
  UpdateCatalogItemRecord,
} from '../../../application/ports/ICatalogRepository.js';
import { CatalogItem } from '../../../domain/entities/CatalogItem.js';
import { TechnicalSpecification } from '../../../domain/entities/TechnicalSpecification.js';

interface CatalogRow extends RowDataPacket {
  id: number;
  category: CatalogCategory;
  type: CatalogSubtype;
  name: string;
  specification: string;
}

interface JoinedSpecRow extends RowDataPacket {
  spec_id: number;
  vehicle_id: number;
  catalog_id: number;
  capacity_liters: number | null;
  interval_km: number | null;
  notes: string | null;
  category: CatalogCategory;
  subtype: CatalogSubtype;
  name: string;
  specification: string;
}

export class MysqlCatalogRepository implements ICatalogRepository {
  public constructor(private readonly pool: Pool) {}

  public async findById(id: number): Promise<CatalogItem | null> {
    const [rows] = await this.pool.execute<CatalogRow[]>(
      'SELECT id, category, type, name, specification FROM catalog WHERE id = ? LIMIT 1',
      [id],
    );
    const first = rows[0];
    if (!first) return null;

    return CatalogItem.create({
      id: first.id,
      category: first.category,
      subtype: first.type,
      name: first.name,
      specification: first.specification,
    });
  }

  public async listAll(): Promise<CatalogItem[]> {
    const [rows] = await this.pool.execute<CatalogRow[]>(
      'SELECT id, category, type, name, specification FROM catalog ORDER BY category ASC, type ASC, name ASC',
    );
    return rows.map((row) =>
      CatalogItem.create({
        id: row.id,
        category: row.category,
        subtype: row.type,
        name: row.name,
        specification: row.specification,
      }),
    );
  }

  public async create(data: CreateCatalogItemRecord): Promise<CatalogItem> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO catalog (category, type, name, specification) VALUES (?, ?, ?, ?)',
      [data.category, data.subtype, data.name, data.specification],
    );

    return CatalogItem.create({
      id: result.insertId,
      category: data.category,
      subtype: data.subtype,
      name: data.name,
      specification: data.specification,
    });
  }

  public async update(data: UpdateCatalogItemRecord): Promise<CatalogItem | null> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE catalog SET category = ?, type = ?, name = ?, specification = ? WHERE id = ?',
      [data.category, data.subtype, data.name, data.specification, data.id],
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return this.findById(data.id);
  }

  public async deleteById(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM catalog WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }

  public async assignToVehicle(data: AssignTechSpecRecord): Promise<TechnicalSpecification> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO technical_specification (vehicle_id, catalog_id, capacity_liters, interval_km, notes) VALUES (?, ?, ?, ?, ?)',
      [data.vehicleId, data.catalogId, data.capacityLiters, data.intervalKm, data.notes],
    );

    return TechnicalSpecification.create({
      id: result.insertId,
      vehicleId: data.vehicleId,
      catalogId: data.catalogId,
      capacityLiters: data.capacityLiters,
      intervalKm: data.intervalKm,
      notes: data.notes,
    });
  }

  public async listSpecsForVehicle(vehicleId: number): Promise<
    Array<{
      spec: TechnicalSpecification;
      catalog: CatalogItem;
    }>
  > {
    const [rows] = await this.pool.execute<JoinedSpecRow[]>(
      `SELECT
         ts.id AS spec_id,
         ts.vehicle_id,
         ts.catalog_id,
         ts.capacity_liters,
         ts.interval_km,
         ts.notes,
         c.category,
         c.type AS subtype,
         c.name,
         c.specification
       FROM technical_specification ts
       INNER JOIN catalog c ON c.id = ts.catalog_id
       WHERE ts.vehicle_id = ?
       ORDER BY
         FIELD(c.category, 'OLEO', 'FILTRO'),
         FIELD(c.type, 'MOTOR', 'FREIO', 'CAMBIO', 'OLEO', 'COMBUSTIVEL', 'AR')`,
      [vehicleId],
    );

    return rows.map((row) => ({
      spec: TechnicalSpecification.create({
        id: row.spec_id,
        vehicleId: row.vehicle_id,
        catalogId: row.catalog_id,
        capacityLiters: row.capacity_liters,
        intervalKm: row.interval_km,
        notes: row.notes,
      }),
      catalog: CatalogItem.create({
        id: row.catalog_id,
        category: row.category,
        subtype: row.subtype,
        name: row.name,
        specification: row.specification,
      }),
    }));
  }
}
