import { AccountStatus, UserRole } from '@soil/shared';
import {
  CreateUserRecord,
  IUserRepository,
} from '../../../application/ports/IUserRepository.js';
import { User } from '../../../domain/entities/User.js';
import { Cnpj } from '../../../domain/value-objects/Cnpj.js';
import { Email } from '../../../domain/value-objects/Email.js';
import { Phone } from '../../../domain/value-objects/Phone.js';

export class InMemoryUserRepository implements IUserRepository {
  private readonly users: User[] = [];
  private readonly passwords = new Map<number, string>();
  private nextId = 1;

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    return this.users.find((u) => u.email.value === normalized) ?? null;
  }

  public async findByLogin(login: string): Promise<User | null> {
    const normalized = login.trim().toLowerCase();
    return this.users.find((u) => u.login === normalized) ?? null;
  }

  public async findById(id: number): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  public async findPasswordHashByUserId(userId: number): Promise<string | null> {
    return this.passwords.get(userId) ?? null;
  }

  public async listPendingUsers(): Promise<User[]> {
    return this.users.filter((u) => u.status === AccountStatus.PENDING);
  }

  public async listAllUsers(): Promise<User[]> {
    return [...this.users];
  }

  public async create(data: CreateUserRecord): Promise<User> {
    const id = this.nextId++;
    const user = User.create({
      id,
      companyId: data.companyId,
      cnpj: Cnpj.create(data.cnpj),
      name: data.name,
      login: data.login,
      email: Email.create(data.email),
      phone: Phone.create(data.phone),
      role: data.role ?? UserRole.USER,
      status: data.status ?? AccountStatus.PENDING,
    });
    this.users.push(user);
    this.passwords.set(id, data.passwordHash);
    return user;
  }

  public async updateStatus(userId: number, status: AccountStatus): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    if (status === AccountStatus.APPROVED) {
      user.approve();
    } else if (status === AccountStatus.REJECTED) {
      user.reject();
    }
  }

  public async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    this.passwords.set(userId, passwordHash);
  }
}
