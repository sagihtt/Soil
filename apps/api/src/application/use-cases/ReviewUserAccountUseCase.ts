import { AccountStatus, UserRole } from '@soil/shared';
import { User } from '../../domain/entities/User.js';
import {
  ForbiddenOperationError,
  ResourceNotFoundError,
} from '../../domain/errors/DomainErrors.js';
import { IUserRepository } from '../ports/IUserRepository.js';

export interface ReviewUserAccountInput {
  actorRole: UserRole;
  targetUserId: number;
  decision: AccountStatus;
}

export class ReviewUserAccountUseCase {
  public constructor(private readonly userRepository: IUserRepository) {}

  public async execute(input: ReviewUserAccountInput): Promise<User> {
    if (input.actorRole !== UserRole.ADMIN) {
      throw new ForbiddenOperationError(
        'Apenas administradores da plataforma podem aprovar ou rejeitar contas.',
      );
    }

    const target = await this.userRepository.findById(input.targetUserId);
    if (target === null) {
      throw new ResourceNotFoundError('Usuário não encontrado.');
    }

    await this.userRepository.updateStatus(target.id, input.decision);

    const updated = await this.userRepository.findById(target.id);
    if (updated === null) {
      throw new ResourceNotFoundError('Usuário não encontrado após atualização.');
    }

    return updated;
  }
}
