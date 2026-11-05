import { AccountStatus } from '@soil/shared';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  CreateCompanyRecord,
  ICompanyRepository,
} from '../../../application/ports/ICompanyRepository.js';
import { Company } from '../../../domain/entities/Company.js';
import { Cnpj } from '../../../domain/value-objects/Cnpj.js';

interface CompanyRow extends RowDataPacket {
  id: number;
  cnpj: string;
  trade_name: string;
  status: AccountStatus;
  created_at: Date;
}

export class MysqlCompanyRepository implements ICompanyRepository {
  public constructor(private readonly pool: Pool) {}

  private mapRow(row: CompanyRow): Company {
    return Company.create({
      id: row.id,
      cnpj: Cnpj.create(row.cnpj),
      tradeName: row.trade_name,
      status: row.status,
      createdAt: new Date(row.created_at),
    });
  }

  public async findByCnpj(cnpj: string): Promise<Company | null> {
    const cleaned = cnpj.replace(/\D/g, '');
    const [rows] = await this.pool.execute<CompanyRow[]>(
      'SELECT id, cnpj, trade_name, status, created_at FROM company WHERE cnpj = ? LIMIT 1',
      [cleaned],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async findById(id: number): Promise<Company | null> {
    const [rows] = await this.pool.execute<CompanyRow[]>(
      'SELECT id, cnpj, trade_name, status, created_at FROM company WHERE id = ? LIMIT 1',
      [id],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async create(data: CreateCompanyRecord): Promise<Company> {
    const cleaned = data.cnpj.replace(/\D/g, '');
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO company (cnpj, trade_name, status) VALUES (?, ?, ?)',
      [cleaned, data.tradeName, AccountStatus.APPROVED],
    );

    return Company.create({
      id: result.insertId,
      cnpj: Cnpj.create(cleaned),
      tradeName: data.tradeName,
      status: AccountStatus.APPROVED,
    });
  }
}
