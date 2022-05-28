import CircuitBreaker from "../src/circuit";
import { ErrorCode } from "../src/common";
import { CircuitBreakerOptions } from "../src/types";
import { mockPromise, MockPromiseResult, sleep } from "./common";

/**
 * Breaker test options
 */
const options: CircuitBreakerOptions = {
  timeout: 100,
  resetTimeout: 200,
  maxFailures: 10,
  debug: false,
};
console.table(options);

let breaker: CircuitBreaker;
beforeEach(() => {
  breaker = new CircuitBreaker(mockPromise, options);
});

it("Breaker switches between open, close, and half-open statuses correctly.", async () => {
  // Initially, breaker must be in the CLOSE state
  expect(breaker.closed).toBeTruthy();
  expect(breaker.opened).toBeFalsy();
  expect(breaker.halfOpen).toBeFalsy();

  // Reject the promise $maxFailures times to OPEN the breaker
  for (let i = 1; i <= breaker.options.maxFailures; i++)
    await breaker.fire(MockPromiseResult.REJECT).catch(() => {});

  // Breaker must be in the OPEN state for the next $resetTimeout milliseconds
  expect(breaker.closed).toBeFalsy();
  expect(breaker.opened).toBeTruthy();
  expect(breaker.halfOpen).toBeFalsy();

  // Wait for $resetTimeout milliseconds
  await sleep(breaker.options.resetTimeout);

  // Breaker must be in the HALF-OPEN state
  expect(breaker.closed).toBeFalsy();
  expect(breaker.opened).toBeFalsy();
  expect(breaker.halfOpen).toBeTruthy();

  // Reject the promise 1 time (with timeout) to OPEN the breaker again
  await breaker
    .fire(MockPromiseResult.RESOLVE, (breaker.options.timeout as number) + 100)
    .catch(() => {});

  // Breaker must be in the OPEN state for the next $resetTimeout milliseconds
  expect(breaker.closed).toBeFalsy();
  expect(breaker.halfOpen).toBeFalsy();
  expect(breaker.opened).toBeTruthy();

  // Wait for $resetTimeout milliseconds
  await sleep(breaker.options.resetTimeout);

  // Resolve the promise 1 time to CLOSE the breaker
  await breaker.fire(MockPromiseResult.RESOLVE);

  // Breaker must be in the CLOSE state
  expect(breaker.closed).toBeTruthy();
  expect(breaker.opened).toBeFalsy();
  expect(breaker.halfOpen).toBeFalsy();
});

it("Breaker respond properly in the open, close, and half-open statuses.", async () => {
  // Initially, breaker must be in the CLOSE state
  await breaker.fire(MockPromiseResult.RESOLVE);

  // Reject the promise $maxFailures times to OPEN the breaker
  for (let i = 1; i <= breaker.options.maxFailures; i++)
    await breaker.fire(MockPromiseResult.REJECT).catch(() => {});

  // Breaker must be in the OPEN state for the next $resetTimeout milliseconds
  await expect(breaker.fire(MockPromiseResult.RESOLVE)).rejects.toThrow(
    ErrorCode.EOPENBREAKER,
  );

  // Wait for $resetTimeout milliseconds
  await sleep(breaker.options.resetTimeout);

  // Breaker must be in the HALF-OPEN state
  // Reject the promise 1 time (with timeout) to OPEN the breaker again
  await expect(
    breaker.fire(
      MockPromiseResult.RESOLVE,
      (breaker.options.timeout as number) + 100,
    ),
  ).rejects.toThrow(ErrorCode.ETIMEDOUT);

  // Breaker must be in the OPEN state for the next $resetTimeout milliseconds
  await expect(breaker.fire(MockPromiseResult.RESOLVE)).rejects.toThrow(
    ErrorCode.EOPENBREAKER,
  );

  // Wait for $resetTimeout milliseconds
  await sleep(breaker.options.resetTimeout);

  // Resolve the promise 1 time to CLOSE the breaker
  await breaker.fire(MockPromiseResult.RESOLVE);

  await expect(breaker.fire(MockPromiseResult.REJECT)).rejects.toThrow(
    MockPromiseResult.REJECT,
  );
});
