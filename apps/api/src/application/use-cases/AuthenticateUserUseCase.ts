import { User } from '../../domain/entities/User.js';
import { UnauthorizedOperationError } from '../../domain/errors/DomainErrors.js';
import { IPasswordHasher } from '../ports/IPasswordHasher.js';
import { IUserRepository } from '../ports/IUserRepository.js';

export interface AuthenticateUserInput {
  loginOrEmail: string;
  password: string;
}

export interface AuthenticateUserOutput {
  user: User;
}

export class AuthenticateUserUseCase {
  public constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  public async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const identifier = input.loginOrEmail.trim().toLowerCase();

    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier)
      : await this.userRepository.findByLogin(identifier);

    if (user === null) {
      throw new UnauthorizedOperationError('Credenciais de acesso inválidas.');
    }

    const storedHash = await this.userRepository.findPasswordHashByUserId(user.id);
    if (storedHash === null) {
      throw new UnauthorizedOperationError('Credenciais de acesso inválidas.');
    }

    const isValid = await this.passwordHasher.verify(input.password, storedHash);
    if (!isValid) {
      throw new UnauthorizedOperationError('Credenciais de acesso inválidas.');
    }

    return { user };
  }
}
