import { DomainValidationError } from '../errors/DomainErrors.js';

export class PasswordPolicy {
  public static validate(rawPassword: string): void {
    if (rawPassword.length < 8 || rawPassword.length > 128) {
      throw new DomainValidationError('A senha deve ter entre 8 e 128 caracteres.');
    }

    if (!/[A-Z]/.test(rawPassword)) {
      throw new DomainValidationError('A senha deve conter pelo menos uma letra maiúscula.');
    }

    if (!/[a-z]/.test(rawPassword)) {
      throw new DomainValidationError('A senha deve conter pelo menos uma letra minúscula.');
    }

    if (!/\d/.test(rawPassword)) {
      throw new DomainValidationError('A senha deve conter pelo menos um número.');
    }

    if (!/[^A-Za-z0-9]/.test(rawPassword)) {
      throw new DomainValidationError('A senha deve conter pelo menos um caractere especial.');
    }
  }
}
