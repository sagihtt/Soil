import { DomainValidationError } from '../errors/DomainErrors.js';
import { Email } from '../value-objects/Email.js';
import { Phone } from '../value-objects/Phone.js';

export interface ClientProps {
  id: number;
  companyId: number;
  name: string;
  phone: Phone;
  email: Email;
  createdAt: Date;
}

export class Client {
  public readonly id: number;
  public readonly companyId: number;
  public readonly name: string;
  public readonly phone: Phone;
  public readonly email: Email;
  public readonly createdAt: Date;

  private constructor(props: ClientProps) {
    this.id = props.id;
    this.companyId = props.companyId;
    this.name = props.name;
    this.phone = props.phone;
    this.email = props.email;
    this.createdAt = props.createdAt;
  }

  public static create(params: {
    id: number;
    companyId: number;
    name: string;
    phone: Phone;
    email: Email;
    createdAt?: Date;
  }): Client {
    const cleanedName = params.name.trim();
    if (cleanedName.length < 2 || cleanedName.length > 150) {
      throw new DomainValidationError('O nome do cliente deve ter entre 2 e 150 caracteres.');
    }

    return new Client({
      id: params.id,
      companyId: params.companyId,
      name: cleanedName,
      phone: params.phone,
      email: params.email,
      createdAt: params.createdAt ?? new Date(),
    });
  }
}
