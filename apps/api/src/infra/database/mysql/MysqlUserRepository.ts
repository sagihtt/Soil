import { AccountStatus, UserRole } from '@soil/shared';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  CreateUserRecord,
  IUserRepository,
} from '../../../application/ports/IUserRepository.js';
import { User } from '../../../domain/entities/User.js';
import { Cnpj } from '../../../domain/value-objects/Cnpj.js';
import { Email } from '../../../domain/value-objects/Email.js';
import { Phone } from '../../../domain/value-objects/Phone.js';

interface UserRow extends RowDataPacket {
  id: number;
  company_id: number;
  cnpj: string;
  name: string;
  login: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  email_verified_at: Date | null;
  created_at: Date;
}

interface PasswordRow extends RowDataPacket {
  password_hash: string;
}

export class MysqlUserRepository implements IUserRepository {
  public constructor(private readonly pool: Pool) {}

  private mapRow(row: UserRow): User {
    return User.create({
      id: row.id,
      companyId: row.company_id,
      cnpj: Cnpj.create(row.cnpj),
      name: row.name,
      login: row.login,
      email: Email.create(row.email),
      phone: Phone.create(row.phone),
      role: row.role,
      status: row.status,
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
      createdAt: new Date(row.created_at),
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, company_id, cnpj, name, login, email, phone, role, status, email_verified_at, created_at FROM `user` WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async findByLogin(login: string): Promise<User | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, company_id, cnpj, name, login, email, phone, role, status, email_verified_at, created_at FROM `user` WHERE login = ? LIMIT 1',
      [login.trim().toLowerCase()],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async findById(id: number): Promise<User | null> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, company_id, cnpj, name, login, email, phone, role, status, email_verified_at, created_at FROM `user` WHERE id = ? LIMIT 1',
      [id],
    );
    const first = rows[0];
    return first ? this.mapRow(first) : null;
  }

  public async findPasswordHashByUserId(userId: number): Promise<string | null> {
    const [rows] = await this.pool.execute<PasswordRow[]>(
      'SELECT password_hash FROM `password` WHERE user_id = ? LIMIT 1',
      [userId],
    );
    return rows[0]?.password_hash ?? null;
  }

  public async listPendingUsers(): Promise<User[]> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, company_id, cnpj, name, login, email, phone, role, status, email_verified_at, created_at FROM `user` WHERE status = ? ORDER BY created_at ASC',
      [AccountStatus.PENDING],
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async listAllUsers(): Promise<User[]> {
    const [rows] = await this.pool.execute<UserRow[]>(
      'SELECT id, company_id, cnpj, name, login, email, phone, role, status, email_verified_at, created_at FROM `user` ORDER BY created_at DESC',
    );
    return rows.map((r) => this.mapRow(r));
  }

  public async create(data: CreateUserRecord): Promise<User> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const role = data.role ?? UserRole.USER;
      const status = data.status ?? AccountStatus.PENDING;

      const [resUser] = await conn.execute<ResultSetHeader>(
        'INSERT INTO `user` (company_id, cnpj, name, login, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          data.companyId,
          data.cnpj,
          data.name,
          data.login,
          data.email,
          data.phone,
          role,
          status,
        ],
      );

      const userId = resUser.insertId;

      await conn.execute(
        'INSERT INTO `password` (user_id, password_hash) VALUES (?, ?)',
        [userId, data.passwordHash],
      );

      await conn.commit();

      return User.create({
        id: userId,
        companyId: data.companyId,
        cnpj: Cnpj.create(data.cnpj),
        name: data.name,
        login: data.login,
        email: Email.create(data.email),
        phone: Phone.create(data.phone),
        role,
        status,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  public async updateStatus(userId: number, status: AccountStatus): Promise<void> {
    await this.pool.execute('UPDATE `user` SET status = ? WHERE id = ?', [status, userId]);
  }

  public async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.pool.execute(
      'UPDATE `password` SET password_hash = ? WHERE user_id = ?',
      [passwordHash, userId],
    );
  }
}
