import { AccountStatus, UserRole } from '@soil/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthenticateUserUseCase } from '../../../src/application/use-cases/AuthenticateUserUseCase.js';
import {
  CreateClientUseCase,
  DeleteClientUseCase,
  ListCompanyClientsUseCase,
} from '../../../src/application/use-cases/ClientManagementUseCases.js';
import { RegisterCompanyUseCase } from '../../../src/application/use-cases/RegisterCompanyUseCase.js';
import { RegisterUserUseCase } from '../../../src/application/use-cases/RegisterUserUseCase.js';
import { ReviewUserAccountUseCase } from '../../../src/application/use-cases/ReviewUserAccountUseCase.js';
import {
  DuplicateResourceError,
  ForbiddenOperationError,
  ResourceNotFoundError,
  UnauthorizedOperationError,
} from '../../../src/domain/errors/DomainErrors.js';
import { InMemoryClientRepository } from '../../../src/infra/database/in-memory/InMemoryClientRepository.js';
import { InMemoryCompanyRepository } from '../../../src/infra/database/in-memory/InMemoryCompanyRepository.js';
import { InMemoryUserRepository } from '../../../src/infra/database/in-memory/InMemoryUserRepository.js';
import { FakePasswordHasher } from '../../../src/infra/security/FakePasswordHasher.js';

describe('Authentication, Admin Curation & Multi-Tenant Client Portfolio (TDD Cycles 3 & 4)', () => {
  let companyRepo: InMemoryCompanyRepository;
  let userRepo: InMemoryUserRepository;
  let clientRepo: InMemoryClientRepository;
  let hasher: FakePasswordHasher;

  let registerCompany: RegisterCompanyUseCase;
  let registerUser: RegisterUserUseCase;
  let authenticateUser: AuthenticateUserUseCase;
  let reviewAccount: ReviewUserAccountUseCase;
  let createClient: CreateClientUseCase;
  let listClients: ListCompanyClientsUseCase;
  let deleteClient: DeleteClientUseCase;

  const cnpjOficinaA = '11.222.333/0001-81';
  const cnpjOficinaB = '11.444.777/0001-61';

  beforeEach(() => {
    companyRepo = new InMemoryCompanyRepository();
    userRepo = new InMemoryUserRepository();
    clientRepo = new InMemoryClientRepository();
    hasher = new FakePasswordHasher();

    registerCompany = new RegisterCompanyUseCase(companyRepo);
    registerUser = new RegisterUserUseCase(companyRepo, userRepo, hasher);
    authenticateUser = new AuthenticateUserUseCase(userRepo, hasher);
    reviewAccount = new ReviewUserAccountUseCase(userRepo);
    createClient = new CreateClientUseCase(clientRepo);
    listClients = new ListCompanyClientsUseCase(clientRepo);
    deleteClient = new DeleteClientUseCase(clientRepo);
  });

  describe('RF03 - Autenticação e Curadoria Admin de Contas', () => {
    it('deve autenticar usuário aprovado por login ou e-mail e rejeitar senha incorreta', async () => {
      await registerCompany.execute({ cnpj: cnpjOficinaA, tradeName: 'Oficina A' });
      const user = await registerUser.execute({
        cnpj: cnpjOficinaA,
        name: 'Operador A',
        login: 'op.a',
        email: 'opa@oficina.com.br',
        phone: '11988887777',
        password: 'Soil@2026!',
        status: AccountStatus.APPROVED,
      });

      const authResult = await authenticateUser.execute({
        loginOrEmail: 'op.a',
        password: 'Soil@2026!',
      });

      expect(authResult.user.id).toBe(user.id);
      expect(authResult.user.companyId).toBe(user.companyId);

      await expect(
        authenticateUser.execute({
          loginOrEmail: 'opa@oficina.com.br',
          password: 'SenhaErrada@1',
        }),
      ).rejects.toThrow(UnauthorizedOperationError);
    });

    it('deve permitir apenas ADMIN aprovar ou rejeitar contas pendentes', async () => {
      await registerCompany.execute({ cnpj: cnpjOficinaA, tradeName: 'Oficina A' });
      const pendingUser = await registerUser.execute({
        cnpj: cnpjOficinaA,
        name: 'Novo Balconista',
        login: 'novo.balcao',
        email: 'novo@oficina.com.br',
        phone: '11988887777',
        password: 'Soil@2026!',
      });

      expect(pendingUser.status).toBe(AccountStatus.PENDING);

      // Usuário comum tentando aprovar deve receber 403
      await expect(
        reviewAccount.execute({
          actorRole: UserRole.USER,
          targetUserId: pendingUser.id,
          decision: AccountStatus.APPROVED,
        }),
      ).rejects.toThrow(ForbiddenOperationError);

      // Admin aprovando
      const updated = await reviewAccount.execute({
        actorRole: UserRole.ADMIN,
        targetUserId: pendingUser.id,
        decision: AccountStatus.APPROVED,
      });

      expect(updated.status).toBe(AccountStatus.APPROVED);
    });
  });

  describe('RF07 - Gestão de Clientes Isolada por CNPJ (Multi-Tenant)', () => {
    it('deve cadastrar cliente no CNPJ da oficina e impedir cliente duplicado no mesmo CNPJ', async () => {
      const companyA = await registerCompany.execute({ cnpj: cnpjOficinaA, tradeName: 'Oficina A' });

      const client = await createClient.execute({
        companyId: companyA.id,
        name: 'João Motorista',
        phone: '(11) 97777-1111',
        email: 'joao@cliente.com.br',
      });

      expect(client.companyId).toBe(companyA.id);
      expect(client.email.value).toBe('joao@cliente.com.br');

      // Tentativa de duplicar no mesmo CNPJ
      await expect(
        createClient.execute({
          companyId: companyA.id,
          name: 'João Motorista Duplicado',
          phone: '(11) 97777-1111',
          email: 'joao@cliente.com.br',
        }),
      ).rejects.toThrow(DuplicateResourceError);
    });

    it('deve permitir cadastrar o mesmo cliente em CNPJs distintos e isolar a exclusão por CNPJ', async () => {
      const companyA = await registerCompany.execute({ cnpj: cnpjOficinaA, tradeName: 'Oficina A' });
      const companyB = await registerCompany.execute({ cnpj: cnpjOficinaB, tradeName: 'Oficina B' });

      const clientInA = await createClient.execute({
        companyId: companyA.id,
        name: 'Maria Frota',
        phone: '(11) 96666-2222',
        email: 'maria@frota.com.br',
      });

      const clientInB = await createClient.execute({
        companyId: companyB.id,
        name: 'Maria Frota',
        phone: '(11) 96666-2222',
        email: 'maria@frota.com.br',
      });

      expect(clientInA.id).not.toBe(clientInB.id);

      // Oficina B não pode excluir o registro que pertence à Oficina A
      await expect(
        deleteClient.execute({
          companyId: companyB.id,
          clientId: clientInA.id,
        }),
      ).rejects.toThrow(ResourceNotFoundError);

      // Oficina A exclui seu próprio cliente sem afetar o cliente da Oficina B
      await deleteClient.execute({
        companyId: companyA.id,
        clientId: clientInA.id,
      });

      const remainingInA = await listClients.execute(companyA.id);
      const remainingInB = await listClients.execute(companyB.id);

      expect(remainingInA).toHaveLength(0);
      expect(remainingInB).toHaveLength(1);
      expect(remainingInB[0]?.id).toBe(clientInB.id);
    });
  });
});
