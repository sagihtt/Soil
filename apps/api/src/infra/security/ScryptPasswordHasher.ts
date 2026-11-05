import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { IPasswordHasher } from '../../application/ports/IPasswordHasher.js';

const scryptAsync = promisify(scryptCallback);

export class ScryptPasswordHasher implements IPasswordHasher {
  private readonly keyLength = 64;

  public async hash(plainText: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(plainText, salt, this.keyLength)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }

  public async verify(plainText: string, digest: string): Promise<boolean> {
    const parts = digest.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1];
    const hashHex = parts[2];
    if (!salt || !hashHex) {
      return false;
    }

    const storedBuffer = Buffer.from(hashHex, 'hex');
    const derivedKey = (await scryptAsync(plainText, salt, this.keyLength)) as Buffer;

    if (storedBuffer.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, derivedKey);
  }
}
