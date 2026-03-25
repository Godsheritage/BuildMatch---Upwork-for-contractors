export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AppError';
    // Maintain proper prototype chain in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
