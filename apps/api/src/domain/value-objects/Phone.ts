import { DomainValidationError } from '../errors/DomainErrors.js';

export class Phone {
  public readonly value: string;

  private constructor(digits: string) {
    this.value = digits;
  }

  public static create(raw: string): Phone {
    const trimmed = raw.trim();

    if (/[a-zA-Z]/.test(trimmed)) {
      throw new DomainValidationError('O telefone não pode conter letras.');
    }

    const digits = trimmed.replace(/\D/g, '');

    if (digits.length < 10 || digits.length > 11) {
      throw new DomainValidationError('O telefone deve conter 10 ou 11 dígitos numéricos com DDD.');
    }

    return new Phone(digits);
  }

  public equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
