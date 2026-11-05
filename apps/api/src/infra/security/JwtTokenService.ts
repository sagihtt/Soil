import { AccountStatus, UserRole } from '@soil/shared';
import { jwtVerify, SignJWT } from 'jose';
import { UnauthorizedOperationError } from '../../domain/errors/DomainErrors.js';

export interface AuthTokenPayload {
  userId: number;
  companyId: number;
  role: UserRole;
  status: AccountStatus;
}

export class JwtTokenService {
  private readonly secretKey: Uint8Array;

  public constructor(secret: string) {
    this.secretKey = new TextEncoder().encode(secret);
  }

  public async sign(payload: AuthTokenPayload, expiresIn: string = '2h'): Promise<string> {
    return new SignJWT({
      companyId: payload.companyId,
      role: payload.role,
      status: payload.status,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(payload.userId))
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secretKey);
  }

  public async verify(token: string): Promise<AuthTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey);
      const userId = Number(payload.sub);
      const companyId = Number(payload['companyId']);
      const role = payload['role'] as UserRole;
      const status = payload['status'] as AccountStatus;

      if (!Number.isInteger(userId) || !Number.isInteger(companyId) || !role || !status) {
        throw new UnauthorizedOperationError('Token JWT com estrutura inválida.');
      }

      return { userId, companyId, role, status };
    } catch {
      throw new UnauthorizedOperationError('Token de acesso inválido ou expirado.');
    }
  }
}
