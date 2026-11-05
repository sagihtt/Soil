import { AccountStatus, UserRole } from '@soil/shared';
import { User } from '../../domain/entities/User.js';

export interface CreateUserRecord {
  companyId: number;
  cnpj: string;
  name: string;
  login: string;
  email: string;
  phone: string;
  passwordHash: string;
  role?: UserRole;
  status?: AccountStatus;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByLogin(login: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  findPasswordHashByUserId(userId: number): Promise<string | null>;
  listPendingUsers(): Promise<User[]>;
  listAllUsers(): Promise<User[]>;
  create(data: CreateUserRecord): Promise<User>;
  updateStatus(userId: number, status: AccountStatus): Promise<void>;
  updatePasswordHash(userId: number, passwordHash: string): Promise<void>;
}
