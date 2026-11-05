import { describe, expect, it } from 'vitest';
import { DomainValidationError } from '../../../src/domain/errors/DomainErrors.js';
import { Cnpj } from '../../../src/domain/value-objects/Cnpj.js';
import { Email } from '../../../src/domain/value-objects/Email.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { PasswordPolicy } from '../../../src/domain/value-objects/PasswordPolicy.js';
import { Phone } from '../../../src/domain/value-objects/Phone.js';
import { YearRange } from '../../../src/domain/value-objects/YearRange.js';

describe('Domain Value Objects (TDD Cycle 1)', () => {
  describe('Cnpj', () => {
    it('deve aceitar um CNPJ válido com ou sem máscara e higienizar para 14 dígitos', () => {
      const cnpjMasked = Cnpj.create('11.222.333/0001-81');
      const cnpjRaw = Cnpj.create('11222333000181');

      expect(cnpjMasked.value).toBe('11222333000181');
      expect(cnpjMasked.formatted).toBe('11.222.333/0001-81');
      expect(cnpjMasked.equals(cnpjRaw)).toBe(true);
    });

    it('deve rejeitar CNPJ contendo letras', () => {
      expect(() => Cnpj.create('11.222.333/0001-8A')).toThrow(DomainValidationError);
    });

    it('deve rejeitar CNPJ com menos ou mais de 14 dígitos', () => {
      expect(() => Cnpj.create('1122233300018')).toThrow(DomainValidationError);
      expect(() => Cnpj.create('112223330001819')).toThrow(DomainValidationError);
    });

    it('deve rejeitar CNPJ com todos os dígitos repetidos', () => {
      expect(() => Cnpj.create('00000000000000')).toThrow(DomainValidationError);
      expect(() => Cnpj.create('11.111.111/1111-11')).toThrow(DomainValidationError);
    });

    it('deve rejeitar CNPJ com dígitos verificadores inválidos pelo Módulo 11', () => {
      expect(() => Cnpj.create('11.222.333/0001-82')).toThrow(DomainValidationError);
    });
  });

  describe('Email', () => {
    it('deve normalizar e-mail válido para minúsculas e sem espaços nas bordas', () => {
      const email = Email.create('  Contato@OficinaMotor.com.br  ');
      expect(email.value).toBe('contato@oficinamotor.com.br');
    });

    it('deve rejeitar e-mails malformados', () => {
      expect(() => Email.create('invalido-sem-arroba.com')).toThrow(DomainValidationError);
      expect(() => Email.create('usuario@')).toThrow(DomainValidationError);
      expect(() => Email.create('@dominio.com')).toThrow(DomainValidationError);
    });
  });

  describe('Phone', () => {
    it('deve aceitar telefone fixo (10 dígitos) e celular (11 dígitos) com máscara', () => {
      const mobile = Phone.create('(11) 98765-4321');
      const landline = Phone.create('(11) 3456-7890');

      expect(mobile.value).toBe('11987654321');
      expect(landline.value).toBe('1134567890');
    });

    it('deve rejeitar telefone contendo letras ou quantidade inválida de dígitos', () => {
      expect(() => Phone.create('1198765432A')).toThrow(DomainValidationError);
      expect(() => Phone.create('123456789')).toThrow(DomainValidationError);
      expect(() => Phone.create('119876543210')).toThrow(DomainValidationError);
    });
  });

  describe('PasswordPolicy', () => {
    it('deve aprovar senha forte com no mínimo 8 caracteres, maiúscula, minúscula, número e símbolo', () => {
      expect(() => PasswordPolicy.validate('Soil@2026!')).not.toThrow();
    });

    it('deve rejeitar senhas que violem qualquer requisito de complexidade', () => {
      expect(() => PasswordPolicy.validate('So@1a')).toThrow(DomainValidationError); // < 8 chars
      expect(() => PasswordPolicy.validate('soil@2026!')).toThrow(DomainValidationError); // sem maiúscula
      expect(() => PasswordPolicy.validate('SOIL@2026!')).toThrow(DomainValidationError); // sem minúscula
      expect(() => PasswordPolicy.validate('Soil@Senha!')).toThrow(DomainValidationError); // sem número
      expect(() => PasswordPolicy.validate('Soil2026A')).toThrow(DomainValidationError); // sem símbolo
    });
  });

  describe('Money', () => {
    it('deve converter valores decimais em centavos exatos e evitar erro de ponto flutuante (0.1 + 0.2)', () => {
      const a = Money.fromPositiveDecimal(0.1);
      const b = Money.fromPositiveDecimal(0.2);
      const sum = a.add(b);

      expect(sum.cents).toBe(30);
      expect(sum.toDecimal()).toBe(0.3);
    });

    it('deve multiplicar preço unitário por litragem fracionária (ex: 4.5L * R$ 45,90 = R$ 206,55)', () => {
      const unitPrice = Money.fromPositiveDecimal(45.9);
      const total = unitPrice.multiply(4.5);

      expect(total.cents).toBe(20655);
      expect(total.toDecimal()).toBe(206.55);
    });

    it('deve rejeitar preços de produto iguais a zero ou negativos', () => {
      expect(() => Money.fromPositiveDecimal(0)).toThrow(DomainValidationError);
      expect(() => Money.fromPositiveDecimal(-15.5)).toThrow(DomainValidationError);
      expect(() => Money.fromPositiveCents(0)).toThrow(DomainValidationError);
      expect(() => Money.fromPositiveCents(-100)).toThrow(DomainValidationError);
    });
  });

  describe('YearRange', () => {
    it('deve validar faixa de anos de fabricação e verificar se um ano pertence ao intervalo', () => {
      const range = YearRange.create(2019, 2023);
      expect(range.contains(2019)).toBe(true);
      expect(range.contains(2021)).toBe(true);
      expect(range.contains(2023)).toBe(true);
      expect(range.contains(2018)).toBe(false);
      expect(range.contains(2024)).toBe(false);
    });

    it('deve rejeitar ano inicial maior que o final ou anos fora de 1900..2100', () => {
      expect(() => YearRange.create(2024, 2020)).toThrow(DomainValidationError);
      expect(() => YearRange.create(1880, 2000)).toThrow(DomainValidationError);
      expect(() => YearRange.create(2020, 2105)).toThrow(DomainValidationError);
    });
  });
});
