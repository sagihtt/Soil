import { Client } from '../../domain/entities/Client.js';

export interface CreateClientRecord {
  companyId: number;
  name: string;
  phone: string;
  email: string;
}

export interface UpdateClientRecord {
  id: number;
  companyId: number;
  name: string;
  phone: string;
  email: string;
}

export interface IClientRepository {
  findByIdAndCompany(id: number, companyId: number): Promise<Client | null>;
  findByEmailAndCompany(email: string, companyId: number): Promise<Client | null>;
  findByPhoneAndCompany(phone: string, companyId: number): Promise<Client | null>;
  listByCompany(companyId: number): Promise<Client[]>;
  create(data: CreateClientRecord): Promise<Client>;
  update(data: UpdateClientRecord): Promise<Client | null>;
  deleteByIdAndCompany(id: number, companyId: number): Promise<boolean>;
}
