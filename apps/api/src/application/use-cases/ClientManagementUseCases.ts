import { Client } from '../../domain/entities/Client.js';
import {
  DuplicateResourceError,
  ResourceNotFoundError,
} from '../../domain/errors/DomainErrors.js';
import { Email } from '../../domain/value-objects/Email.js';
import { Phone } from '../../domain/value-objects/Phone.js';
import { IClientRepository } from '../ports/IClientRepository.js';

export interface CreateClientInput {
  companyId: number;
  name: string;
  phone: string;
  email: string;
}

export class CreateClientUseCase {
  public constructor(private readonly clientRepository: IClientRepository) {}

  public async execute(input: CreateClientInput): Promise<Client> {
    const email = Email.create(input.email);
    const phone = Phone.create(input.phone);

    Client.create({
      id: 1,
      companyId: input.companyId,
      name: input.name,
      phone,
      email,
    });

    const dupEmail = await this.clientRepository.findByEmailAndCompany(
      email.value,
      input.companyId,
    );
    if (dupEmail !== null) {
      throw new DuplicateResourceError(
        'Já existe um cliente com este e-mail cadastrado nesta empresa.',
      );
    }

    const dupPhone = await this.clientRepository.findByPhoneAndCompany(
      phone.value,
      input.companyId,
    );
    if (dupPhone !== null) {
      throw new DuplicateResourceError(
        'Já existe um cliente com este telefone cadastrado nesta empresa.',
      );
    }

    return this.clientRepository.create({
      companyId: input.companyId,
      name: input.name.trim(),
      phone: phone.value,
      email: email.value,
    });
  }
}

export class ListCompanyClientsUseCase {
  public constructor(private readonly clientRepository: IClientRepository) {}

  public async execute(companyId: number): Promise<Client[]> {
    return this.clientRepository.listByCompany(companyId);
  }
}

export class UpdateClientUseCase {
  public constructor(private readonly clientRepository: IClientRepository) {}

  public async execute(input: {
    clientId: number;
    companyId: number;
    name: string;
    phone: string;
    email: string;
  }): Promise<Client> {
    const existing = await this.clientRepository.findByIdAndCompany(
      input.clientId,
      input.companyId,
    );
    if (existing === null) {
      throw new ResourceNotFoundError('Cliente não encontrado para a empresa informada.');
    }

    const email = Email.create(input.email);
    const phone = Phone.create(input.phone);

    Client.create({
      id: input.clientId,
      companyId: input.companyId,
      name: input.name,
      phone,
      email,
    });

    const dupEmail = await this.clientRepository.findByEmailAndCompany(
      email.value,
      input.companyId,
    );
    if (dupEmail !== null && dupEmail.id !== input.clientId) {
      throw new DuplicateResourceError(
        'Já existe outro cliente com este e-mail cadastrado nesta empresa.',
      );
    }

    const dupPhone = await this.clientRepository.findByPhoneAndCompany(
      phone.value,
      input.companyId,
    );
    if (dupPhone !== null && dupPhone.id !== input.clientId) {
      throw new DuplicateResourceError(
        'Já existe outro cliente com este telefone cadastrado nesta empresa.',
      );
    }

    const updated = await this.clientRepository.update({
      id: input.clientId,
      companyId: input.companyId,
      name: input.name.trim(),
      phone: phone.value,
      email: email.value,
    });

    if (updated === null) {
      throw new ResourceNotFoundError('Cliente não encontrado para a empresa informada.');
    }

    return updated;
  }
}

export class DeleteClientUseCase {
  public constructor(private readonly clientRepository: IClientRepository) {}

  public async execute(params: { companyId: number; clientId: number }): Promise<void> {
    const deleted = await this.clientRepository.deleteByIdAndCompany(
      params.clientId,
      params.companyId,
    );
    if (!deleted) {
      throw new ResourceNotFoundError('Cliente não encontrado para a empresa informada.');
    }
  }
}
