import { DomainValidationError } from '../errors/DomainErrors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class Email {
  public readonly value: string;

  private constructor(normalized: string) {
    this.value = normalized;
  }

  public static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (!normalized || normalized.length > 255 || !EMAIL_REGEX.test(normalized)) {
      throw new DomainValidationError('O endereço de e-mail informado é inválido.');
    }

    return new Email(normalized);
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }
}
