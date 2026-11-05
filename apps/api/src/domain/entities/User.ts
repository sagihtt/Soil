import { AccountStatus, UserRole } from '@soil/shared';
import { DomainValidationError } from '../errors/DomainErrors.js';
import { Cnpj } from '../value-objects/Cnpj.js';
import { Email } from '../value-objects/Email.js';
import { Phone } from '../value-objects/Phone.js';

export interface UserProps {
  id: number;
  companyId: number;
  cnpj: Cnpj;
  name: string;
  login: string;
  email: Email;
  phone: Phone;
  role: UserRole;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export class User {
  public readonly id: number;
  public readonly companyId: number;
  public readonly cnpj: Cnpj;
  public readonly name: string;
  public readonly login: string;
  public readonly email: Email;
  public readonly phone: Phone;
  public readonly role: UserRole;
  private _status: AccountStatus;
  private _emailVerifiedAt: Date | null;
  public readonly createdAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.cnpj = props.cnpj;
    this.name = props.name;
    this.login = props.login;
    this.email = props.email;
    this.phone = props.phone;
    this.role = props.role;
    this._status = props.status;
    this._emailVerifiedAt = props.emailVerifiedAt;
    this.createdAt = props.createdAt;
  }

  public static create(params: {
    id: number;
    companyId: number;
    cnpj: Cnpj;
    name: string;
    login: string;
    email: Email;
    phone: Phone;
    role?: UserRole;
    status?: AccountStatus;
    emailVerifiedAt?: Date | null;
    createdAt?: Date;
  }): User {
    const cleanedName = params.name.trim();
    if (cleanedName.length < 2 || cleanedName.length > 150) {
      throw new DomainValidationError('O nome do usuário deve ter entre 2 e 150 caracteres.');
    }

    const normalizedLogin = params.login.trim().toLowerCase();
    if (normalizedLogin.length < 3 || normalizedLogin.length > 60 || /\s/.test(normalizedLogin)) {
      throw new DomainValidationError('O login deve ter entre 3 e 60 caracteres e não conter espaços.');
    }

    return new User({
      id: params.id,
      companyId: params.companyId,
      cnpj: params.cnpj,
      name: cleanedName,
      login: normalizedLogin,
      email: params.email,
      phone: params.phone,
      role: params.role ?? UserRole.USER,
      status: params.status ?? AccountStatus.PENDING,
      emailVerifiedAt: params.emailVerifiedAt ?? null,
      createdAt: params.createdAt ?? new Date(),
    });
  }

  public get status(): AccountStatus {
    return this._status;
  }

  public get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }

  public approve(): void {
    this._status = AccountStatus.APPROVED;
  }

  public reject(): void {
    this._status = AccountStatus.REJECTED;
  }

  public markEmailVerified(at: Date = new Date()): void {
    this._emailVerifiedAt = at;
  }
}
