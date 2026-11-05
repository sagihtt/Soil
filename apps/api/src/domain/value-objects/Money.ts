import { DomainValidationError } from '../errors/DomainErrors.js';

/**
 * Representa valores monetários em centavos inteiros (Martin Fowler, Money Pattern),
 * eliminando erros de ponto flutuante IEEE 754 no cálculo de orçamentos.
 */
export class Money {
  public readonly cents: number;

  private constructor(cents: number) {
    this.cents = cents;
  }

  public static zero(): Money {
    return new Money(0);
  }

  public static fromPositiveCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents <= 0) {
      throw new DomainValidationError('O valor em centavos deve ser um número inteiro maior que zero.');
    }
    return new Money(cents);
  }

  public static fromNonNegativeCents(cents: number): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new DomainValidationError('O valor em centavos não pode ser negativo.');
    }
    return new Money(cents);
  }

  public static fromPositiveDecimal(amount: number): Money {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new DomainValidationError('O preço deve ser maior que zero.');
    }
    const cents = Math.round(amount * 100);
    if (cents <= 0) {
      throw new DomainValidationError('O preço deve ser maior que zero.');
    }
    return new Money(cents);
  }

  public add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  public multiply(quantity: number): Money {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new DomainValidationError('A quantidade multiplicadora deve ser maior que zero.');
    }
    return new Money(Math.round(this.cents * quantity));
  }

  public toDecimal(): number {
    return Number((this.cents / 100).toFixed(2));
  }

  public equals(other: Money): boolean {
    return this.cents === other.cents;
  }
}
