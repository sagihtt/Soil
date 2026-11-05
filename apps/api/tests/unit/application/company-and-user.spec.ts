import { beforeEach, describe, expect, it } from 'vitest';
import { RegisterCompanyUseCase } from '../../../src/application/use-cases/RegisterCompanyUseCase.js';
import { RegisterUserUseCase } from '../../../src/application/use-cases/RegisterUserUseCase.js';
import {
  DomainValidationError,
  DuplicateResourceError,
  ResourceNotFoundError,
} from '../../../src/domain/errors/DomainErrors.js';
import { InMemoryCompanyRepository } from '../../../src/infra/database/in-memory/InMemoryCompanyRepository.js';
import { InMemoryUserRepository } from '../../../src/infra/database/in-memory/InMemoryUserRepository.js';
import { FakePasswordHasher } from '../../../src/infra/security/FakePasswordHasher.js';

describe('Company and User Registration (TDD Cycle 2 - RF01 & RF02)', () => {
  let companyRepo: InMemoryCompanyRepository;
  let userRepo: InMemoryUserRepository;
  let passwordHasher: FakePasswordHasher;
  let registerCompany: RegisterCompanyUseCase;
  let registerUser: RegisterUserUseCase;

  const validCnpj1 = '11.222.333/0001-81';
  const validCnpj2 = '11.444.777/0001-61';

  beforeEach(() => {
    companyRepo = new InMemoryCompanyRepository();
    userRepo = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    registerCompany = new RegisterCompanyUseCase(companyRepo);
    registerUser = new RegisterUserUseCase(companyRepo, userRepo, passwordHasher);
  });

  describe('RF01 - Cadastro de Empresa (CNPJ)', () => {
    it('deve cadastrar uma empresa válida com CNPJ higienizado', async () => {
      const company = await registerCompany.execute({
        cnpj: validCnpj1,
        tradeName: 'Auto Center Paulista',
      });

      expect(company.id).toBe(1);
      expect(company.cnpj.value).toBe('11222333000181');
      expect(company.tradeName).toBe('Auto Center Paulista');
    });

    it('deve impedir o cadastro de duas empresas com o mesmo CNPJ (409 Conflict)', async () => {
      await registerCompany.execute({
        cnpj: validCnpj1,
        tradeName: 'Oficina Original',
      });

      await expect(
        registerCompany.execute({
          cnpj: '11222333000181', // mesmo CNPJ sem máscara
          tradeName: 'Outra Oficina',
        }),
      ).rejects.toThrow(DuplicateResourceError);
    });

    it('deve permitir empresas com o mesmo Nome Fantasia desde que tenham CNPJs distintos', async () => {
      const c1 = await registerCompany.execute({
        cnpj: validCnpj1,
        tradeName: 'Troca Rápida Lubrificantes',
      });
      const c2 = await registerCompany.execute({
        cnpj: validCnpj2,
        tradeName: 'Troca Rápida Lubrificantes',
      });

      expect(c1.id).not.toBe(c2.id);
      expect(c1.tradeName).toBe(c2.tradeName);
    });
  });

  describe('RF02 - Cadastro de Usuários vinculados ao CNPJ', () => {
    it('deve permitir múltiplos usuários (funcionários) vinculados ao mesmo CNPJ com logins e e-mails distintos', async () => {
      const company = await registerCompany.execute({
        cnpj: validCnpj1,
        tradeName: 'Auto Center Paulista',
      });

      const user1 = await registerUser.execute({
        cnpj: validCnpj1,
        name: 'Carlos Silva',
        login: 'carlos.silva',
        email: 'carlos@autocenter.com.br',
        phone: '(11) 98888-7777',
        password: 'Soil@2026!',
      });

      const user2 = await registerUser.execute({
        cnpj: validCnpj1,
        name: 'Carlos Silva', // mesmo nome próprio permitido pelo Roteiro de Testes
        login: 'carlos.balcao2',
        email: 'carlos2@autocenter.com.br',
        phone: '(11) 98888-6666',
        password: 'Soil@2026!',
      });

      expect(user1.companyId).toBe(company.id);
      expect(user2.companyId).toBe(company.id);
      expect(user1.id).not.toBe(user2.id);

      const savedHash = await userRepo.findPasswordHashByUserId(user1.id);
      expect(savedHash).toBe('hashed:Soil@2026!');
    });

    it('deve rejeitar cadastro de usuário quando o CNPJ não estiver cadastrado', async () => {
      await expect(
        registerUser.execute({
          cnpj: validCnpj1,
          name: 'Operador Sem Empresa',
          login: 'operador1',
          email: 'op@oficina.com.br',
          phone: '11999998888',
          password: 'Soil@2026!',
        }),
      ).rejects.toThrow(ResourceNotFoundError);
    });

    it('deve rejeitar cadastro de usuário com e-mail ou login duplicado', async () => {
      await registerCompany.execute({
        cnpj: validCnpj1,
        tradeName: 'Auto Center Paulista',
      });

      await registerUser.execute({
        cnpj: validCnpj1,
        name: 'Operador 1',
        login: 'operador.unico',
        email: 'unico@oficina.com.br',
        phone: '11999998888',
        password: 'Soil@2026!',
      });

      // Mesmo e-mail
      await expect(
        registerUser.execute({
          cnpj: validCnpj1,
          name: 'Operador 2',
          login: 'outro.login',
          email: 'UNICO@oficina.com.br',
          phone: '11977776666',
          password: 'Soil@2026!',
        }),
      ).rejects.toThrow(DuplicateResourceError);

      // Mesmo login
      await expect(
        registerUser.execute({
          cnpj: validCnpj1,
          name: 'Operador 3',
          login: 'OPERADOR.UNICO',
          email: 'outro@oficina.com.br',
          phone: '11977775555',
          password: 'Soil@2026!',
        }),
      ).rejects.toThrow(DuplicateResourceError);
    });

    it('deve rejeitar senha fraca antes de persistir o usuário', async () => {
      await registerCompany.execute({
        cnpj: validCnpj1,
        tradeName: 'Auto Center Paulista',
      });

      await expect(
        registerUser.execute({
          cnpj: validCnpj1,
          name: 'Operador Senha Fraca',
          login: 'op.fraca',
          email: 'fraca@oficina.com.br',
          phone: '11999998888',
          password: '12345678',
        }),
      ).rejects.toThrow(DomainValidationError);
    });
  });
});
