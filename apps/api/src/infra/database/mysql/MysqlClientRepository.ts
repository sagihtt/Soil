import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  CreateClientRecord,
  IClientRepository,
  UpdateClientRecord,
} from '../../../application/ports/IClientRepository.js';
import { Client } from '../../../domain/entities/Client.js';
import { Email } from '../../../domain/value-objects/Email.js';
import { Phone } from '../../../domain/value-objects/Phone.js';

interface ClientRow extends RowDataPacket {
  id: number;
  company_id: number;
  name: string;
  phone: string;
  email: string;
  created_at: Date;
}

export class MysqlClientRepository implements IClientRepository {
  public constructor(private readonly pool: Pool) {}

  private mapRow(row: ClientRow): Client {
    return Client.create({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      phone: Phone.create(row.phone),
      email: Email.create(row.email),
      createdAt: new Date(row.created_at),
    });
  }

  public async findByIdAndCompany(id: number, companyId: number): Promise<Client | null> {
    const [rows] = await this.pool.execute<ClientRow[]>(
      'SELECT id, company_id, name, phone, email, created_at FROM `client` WHERE id = ? AND company_id = ? LIMIT 1',
      [id, companyId],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async findByEmailAndCompany(email: string, companyId: number): Promise<Client | null> {
    const [rows] = await this.pool.execute<ClientRow[]>(
      'SELECT id, company_id, name, phone, email, created_at FROM `client` WHERE company_id = ? AND email = ? LIMIT 1',
      [companyId, email.trim().toLowerCase()],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async findByPhoneAndCompany(phone: string, companyId: number): Promise<Client | null> {
    const [rows] = await this.pool.execute<ClientRow[]>(
      'SELECT id, company_id, name, phone, email, created_at FROM `client` WHERE company_id = ? AND phone = ? LIMIT 1',
      [companyId, phone.replace(/\D/g, '')],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async listByCompany(companyId: number): Promise<Client[]> {
    const [rows] = await this.pool.execute<ClientRow[]>(
      'SELECT id, company_id, name, phone, email, created_at FROM `client` WHERE company_id = ? ORDER BY name ASC',
      [companyId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async create(data: CreateClientRecord): Promise<Client> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'INSERT INTO `client` (company_id, name, phone, email) VALUES (?, ?, ?, ?)',
      [data.companyId, data.name, data.phone, data.email],
    );

    return Client.create({
      id: result.insertId,
      companyId: data.companyId,
      name: data.name,
      phone: Phone.create(data.phone),
      email: Email.create(data.email),
    });
  }

  public async update(data: UpdateClientRecord): Promise<Client | null> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE `client` SET name = ?, phone = ?, email = ? WHERE id = ? AND company_id = ?',
      [data.name, data.phone, data.email, data.id, data.companyId],
    );
    if (result.affectedRows === 0) {
      return null;
    }
    return this.findByIdAndCompany(data.id, data.companyId);
  }

  public async deleteByIdAndCompany(id: number, companyId: number): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM `client` WHERE id = ? AND company_id = ?',
      [id, companyId],
    );
    return result.affectedRows > 0;
  }
}
