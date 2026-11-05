import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  CreateVehicleRecord,
  IVehicleRepository,
  UpdateVehicleRecord,
} from '../../../application/ports/IVehicleRepository.js';
import { Vehicle } from '../../../domain/entities/Vehicle.js';
import { YearRange } from '../../../domain/value-objects/YearRange.js';

interface VehicleRow extends RowDataPacket {
  id: number;
  manufacturer: string;
  model: string;
  version: string | null;
  type: string;
  manuf_year_start: number;
  manuf_year_end: number;
}

interface ManufacturerRow extends RowDataPacket {
  manufacturer: string;
}

export class MysqlVehicleRepository implements IVehicleRepository {
  public constructor(private readonly pool: Pool) {}

  private mapRow(row: VehicleRow): Vehicle {
    return Vehicle.create({
      id: row.id,
      manufacturer: row.manufacturer,
      model: row.model,
      version: row.version,
      type: row.type,
      yearRange: YearRange.create(row.manuf_year_start, row.manuf_year_end),
    });
  }

  public async findById(id: number): Promise<Vehicle | null> {
    const [rows] = await this.pool.execute<VehicleRow[]>(
      'SELECT id, manufacturer, model, version, type, manuf_year_start, manuf_year_end FROM vehicle WHERE id = ? LIMIT 1',
      [id],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async searchApproximate(query: string, year?: number): Promise<Vehicle[]> {
    const likeTerm = `%${query.trim()}%`;
    let sql = `
      SELECT id, manufacturer, model, version, type, manuf_year_start, manuf_year_end
      FROM vehicle
      WHERE (
        manufacturer LIKE ?
        OR model LIKE ?
        OR IFNULL(version, '') LIKE ?
        OR CONCAT(manufacturer, ' ', model, ' ', IFNULL(version, '')) LIKE ?
      )
    `;
    const params: Array<string | number> = [likeTerm, likeTerm, likeTerm, likeTerm];

    if (year !== undefined) {
      sql += ' AND ? BETWEEN manuf_year_start AND manuf_year_end';
      params.push(year);
    }

    sql += ' ORDER BY manufacturer ASC, model ASC, manuf_year_start DESC LIMIT 50';

    const [rows] = await this.pool.execute<VehicleRow[]>(sql, params);
    return rows.map((r) => this.mapRow(r));
  }

  public async listManufacturers(): Promise<string[]> {
    const [rows] = await this.pool.execute<ManufacturerRow[]>(
      'SELECT DISTINCT manufacturer FROM vehicle ORDER BY manufacturer ASC',
    );
    return rows.map((r) => r.manufacturer);
  }

  public async create(data: CreateVehicleRecord): Promise<Vehicle> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO vehicle (manufacturer, model, version, type, manuf_year_start, manuf_year_end) VALUES (?, ?, ?, ?, ?, ?)',
      [
        data.manufacturer,
        data.model,
        data.version,
        data.type,
        data.manufYearStart,
        data.manufYearEnd,
      ],
    );

    return Vehicle.create({
      id: result.insertId,
      manufacturer: data.manufacturer,
      model: data.model,
      version: data.version,
      type: data.type,
      yearRange: YearRange.create(data.manufYearStart, data.manufYearEnd),
    });
  }

  public async update(data: UpdateVehicleRecord): Promise<Vehicle | null> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE vehicle SET manufacturer = ?, model = ?, version = ?, type = ?, manuf_year_start = ?, manuf_year_end = ? WHERE id = ?',
      [
        data.manufacturer,
        data.model,
        data.version,
        data.type,
        data.manufYearStart,
        data.manufYearEnd,
        data.id,
      ],
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return this.findById(data.id);
  }

  public async deleteById(id: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM vehicle WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }
}
