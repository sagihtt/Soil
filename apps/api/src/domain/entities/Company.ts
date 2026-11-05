import { AccountStatus } from '@soil/shared';
import { DomainValidationError } from '../errors/DomainErrors.js';
import { Cnpj } from '../value-objects/Cnpj.js';

export interface CompanyProps {
  id: number;
  cnpj: Cnpj;
  tradeName: string;
  status: AccountStatus;
  createdAt: Date;
}

export class Company {
  public readonly id: number;
  public readonly cnpj: Cnpj;
  public readonly tradeName: string;
  public readonly status: AccountStatus;
  public readonly createdAt: Date;

  private constructor(props: CompanyProps) {
    this.id = props.id;
    this.cnpj = props.cnpj;
    this.tradeName = props.tradeName;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  public static create(params: {
    id: number;
    cnpj: Cnpj;
    tradeName: string;
    status?: AccountStatus;
    createdAt?: Date;
  }): Company {
    const cleanedName = params.tradeName.trim();
    if (cleanedName.length < 2 || cleanedName.length > 150) {
      throw new DomainValidationError('O Nome Fantasia da empresa deve ter entre 2 e 150 caracteres.');
    }

    return new Company({
      id: params.id,
      cnpj: params.cnpj,
      tradeName: cleanedName,
      status: params.status ?? AccountStatus.APPROVED,
      createdAt: params.createdAt ?? new Date(),
    });
  }
}
