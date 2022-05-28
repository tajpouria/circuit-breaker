export enum MockPromiseResult {
  RESOLVE = "RESOLVE",
  REJECT = "REJECT",
}
/**
 * Mock a promise.
 * @param {MockPromiseResult} result Promise result
 * @param {Number} ms How many **milliseconds** to wait before fulfilling the promise
 * @returns {Promise<MockPromiseResult>} Promise result
 */
export const mockPromise = (
  result: MockPromiseResult,
  ms: number = 0,
): Promise<MockPromiseResult> =>
  new Promise((resolve, reject) =>
    setTimeout(
      () =>
        result === MockPromiseResult.RESOLVE
          ? resolve(result)
          : reject(new Error(result)),
      ms,
    ),
  );

/**
 * Delay for a specified amount of time.
 * @param ms How many **milliseconds** to wait before fulfilling the promise
 * @returns {Promise<unknown>}
 */
export const sleep = (ms: number): Promise<unknown> =>
  new Promise((resolve) => setTimeout(resolve, ms));
