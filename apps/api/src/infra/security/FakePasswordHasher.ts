import { IPasswordHasher } from '../../application/ports/IPasswordHasher.js';

export class FakePasswordHasher implements IPasswordHasher {
  public async hash(plainText: string): Promise<string> {
    return `hashed:${plainText}`;
  }

  public async verify(plainText: string, digest: string): Promise<boolean> {
    return digest === `hashed:${plainText}`;
  }
}
