export interface IPasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, digest: string): Promise<boolean>;
}
