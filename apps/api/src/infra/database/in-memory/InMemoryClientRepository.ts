import {
  CreateClientRecord,
  IClientRepository,
  UpdateClientRecord,
} from '../../../application/ports/IClientRepository.js';
import { Client } from '../../../domain/entities/Client.js';
import { Email } from '../../../domain/value-objects/Email.js';
import { Phone } from '../../../domain/value-objects/Phone.js';

export class InMemoryClientRepository implements IClientRepository {
  private readonly clients: Client[] = [];
  private nextId = 1;

  public async findByIdAndCompany(id: number, companyId: number): Promise<Client | null> {
    return this.clients.find((c) => c.id === id && c.companyId === companyId) ?? null;
  }

  public async findByEmailAndCompany(email: string, companyId: number): Promise<Client | null> {
    const normalized = email.trim().toLowerCase();
    return (
      this.clients.find((c) => c.companyId === companyId && c.email.value === normalized) ??
      null
    );
  }

  public async findByPhoneAndCompany(phone: string, companyId: number): Promise<Client | null> {
    const digits = phone.replace(/\D/g, '');
    return (
      this.clients.find((c) => c.companyId === companyId && c.phone.value === digits) ?? null
    );
  }

  public async listByCompany(companyId: number): Promise<Client[]> {
    return this.clients.filter((c) => c.companyId === companyId);
  }

  public async create(data: CreateClientRecord): Promise<Client> {
    const client = Client.create({
      id: this.nextId++,
      companyId: data.companyId,
      name: data.name,
      phone: Phone.create(data.phone),
      email: Email.create(data.email),
    });
    this.clients.push(client);
    return client;
  }

  public async update(data: UpdateClientRecord): Promise<Client | null> {
    const idx = this.clients.findIndex((c) => c.id === data.id && c.companyId === data.companyId);
    if (idx === -1) return null;
    const existing = this.clients[idx]!;
    const updated = Client.create({
      id: existing.id,
      companyId: existing.companyId,
      name: data.name,
      phone: Phone.create(data.phone),
      email: Email.create(data.email),
      createdAt: existing.createdAt,
    });
    this.clients[idx] = updated;
    return updated;
  }

  public async deleteByIdAndCompany(id: number, companyId: number): Promise<boolean> {
    const idx = this.clients.findIndex((c) => c.id === id && c.companyId === companyId);
    if (idx === -1) return false;
    this.clients.splice(idx, 1);
    return true;
  }
}
