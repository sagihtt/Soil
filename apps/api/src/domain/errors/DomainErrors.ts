export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public abstract readonly httpStatus: number;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DomainValidationError extends DomainError {
  public readonly code = 'DOMAIN_VALIDATION_ERROR';
  public readonly httpStatus = 422;

  public constructor(message: string) {
    super(message);
  }
}

export class DuplicateResourceError extends DomainError {
  public readonly code = 'DUPLICATE_RESOURCE';
  public readonly httpStatus = 409;

  public constructor(message: string) {
    super(message);
  }
}

export class ResourceNotFoundError extends DomainError {
  public readonly code = 'RESOURCE_NOT_FOUND';
  public readonly httpStatus = 404;

  public constructor(message: string) {
    super(message);
  }
}

export class ForbiddenOperationError extends DomainError {
  public readonly code = 'FORBIDDEN_OPERATION';
  public readonly httpStatus = 403;

  public constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedOperationError extends DomainError {
  public readonly code = 'UNAUTHORIZED_OPERATION';
  public readonly httpStatus = 401;

  public constructor(message: string) {
    super(message);
  }
}
