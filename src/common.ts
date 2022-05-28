export enum ErrorCode {
  EOPENBREAKER = "EOPENBREAKER",
  ETIMEDOUT = "ETIMEDOUT",
}
/**
 * Construct a standard error.
 * @param {ErrorCode} code
 * @returns
 */
export const buildError = (code: ErrorCode): Error => {
  const error = new Error(code);
  error.name = "CircuitBreaker";
  return error;
};
