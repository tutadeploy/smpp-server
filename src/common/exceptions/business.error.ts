export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly errorCode: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
