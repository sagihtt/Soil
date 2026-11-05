import { DomainValidationError } from '../errors/DomainErrors.js';

export class Cnpj {
  public readonly value: string;

  private constructor(digits: string) {
    this.value = digits;
  }

  public static create(raw: string): Cnpj {
    const trimmed = raw.trim();

    if (/[a-zA-Z]/.test(trimmed)) {
      throw new DomainValidationError('O CNPJ não pode conter letras.');
    }

    const digits = trimmed.replace(/\D/g, '');

    if (digits.length !== 14) {
      throw new DomainValidationError('O CNPJ deve conter exatamente 14 dígitos numéricos.');
    }

    if (/^(\d)\1{13}$/.test(digits)) {
      throw new DomainValidationError('O CNPJ informado é inválido (dígitos repetidos).');
    }

    if (!Cnpj.hasValidCheckDigits(digits)) {
      throw new DomainValidationError('Os dígitos verificadores do CNPJ são inválidos.');
    }

    return new Cnpj(digits);
  }

  private static hasValidCheckDigits(digits: string): boolean {
    const calcDigit = (slice: string, weights: readonly number[]): number => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += Number(slice[i]) * (weights[i] ?? 0);
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
    const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

    const firstDigit = calcDigit(digits.slice(0, 12), weightsFirst);
    const secondDigit = calcDigit(digits.slice(0, 13), weightsSecond);

    return Number(digits[12]) === firstDigit && Number(digits[13]) === secondDigit;
  }

  public get formatted(): string {
    return this.value.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  public equals(other: Cnpj): boolean {
    return this.value === other.value;
  }
}
