import { AccountStatus, UserRole } from '@soil/shared';
import { User } from '../../domain/entities/User.js';
import {
  DuplicateResourceError,
  ResourceNotFoundError,
} from '../../domain/errors/DomainErrors.js';
import { Cnpj } from '../../domain/value-objects/Cnpj.js';
import { Email } from '../../domain/value-objects/Email.js';
import { PasswordPolicy } from '../../domain/value-objects/PasswordPolicy.js';
import { Phone } from '../../domain/value-objects/Phone.js';
import { ICompanyRepository } from '../ports/ICompanyRepository.js';
import { IPasswordHasher } from '../ports/IPasswordHasher.js';
import { IUserRepository } from '../ports/IUserRepository.js';

export interface RegisterUserInput {
  cnpj: string;
  name: string;
  login: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
  status?: AccountStatus;
}

export class RegisterUserUseCase {
  public constructor(
    private readonly companyRepository: ICompanyRepository,
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  public async execute(input: RegisterUserInput): Promise<User> {
    const cnpj = Cnpj.create(input.cnpj);
    const email = Email.create(input.email);
    const phone = Phone.create(input.phone);
    PasswordPolicy.validate(input.password);

    const company = await this.companyRepository.findByCnpj(cnpj.value);
    if (company === null) {
      throw new ResourceNotFoundError('Empresa (CNPJ) não encontrada para vincular o usuário.');
    }

    const normalizedLogin = input.login.trim().toLowerCase();

    // Valida invariantes da entidade User antes de tocar no banco
    User.create({
      id: 1,
      companyId: company.id,
      cnpj,
      name: input.name,
      login: normalizedLogin,
      email,
      phone,
    });

    const existingByEmail = await this.userRepository.findByEmail(email.value);
    if (existingByEmail !== null) {
      throw new DuplicateResourceError('Já existe um usuário cadastrado com este e-mail.');
    }

    const existingByLogin = await this.userRepository.findByLogin(normalizedLogin);
    if (existingByLogin !== null) {
      throw new DuplicateResourceError('Já existe um usuário cadastrado com este login.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const record: {
      companyId: number;
      cnpj: string;
      name: string;
      login: string;
      email: string;
      phone: string;
      passwordHash: string;
      role?: UserRole;
      status?: AccountStatus;
    } = {
      companyId: company.id,
      cnpj: cnpj.value,
      name: input.name.trim(),
      login: normalizedLogin,
      email: email.value,
      phone: phone.value,
      passwordHash,
    };

    if (input.role !== undefined) {
      record.role = input.role;
    }
    if (input.status !== undefined) {
      record.status = input.status;
    }

    return this.userRepository.create(record);
  }
}
