import CircuitBreaker from "../src/circuit";
import { mockPromise, MockPromiseResult, sleep } from "../test/common";

(async () => {
  const breaker = new CircuitBreaker(mockPromise, {
    timeout: 100,
    resetTimeout: 3000,
    maxFailures: 3,
    debug: true,
  });

  // Initially, breaker must be in the CLOSE state
  await breaker.fire(MockPromiseResult.RESOLVE);

  // Reject the promise $maxFailures times to OPEN the breaker
  for (let i = 1; i <= breaker.options.maxFailures; i++)
    await breaker.fire(MockPromiseResult.REJECT).catch(() => {});

  // Breaker must be in the OPEN state for the next $resetTimeout milliseconds
  breaker.fire(MockPromiseResult.RESOLVE).catch(() => {});

  // Wait for $resetTimeout milliseconds
  await sleep(breaker.options.resetTimeout);

  // Resolve the promise 1 time to CLOSE the breaker
  await breaker.fire(MockPromiseResult.RESOLVE);

  // Breaker must be in the CLOSE state
  for (let i = 1; i <= breaker.options.maxFailures - 1; i++)
    breaker.fire(MockPromiseResult.REJECT).catch(() => {});

  // Resolve the promise 1 time to CLOSE the breaker
  await breaker
    .fire(MockPromiseResult.RESOLVE, (breaker.options.timeout as number) + 1)
    .catch(() => {});
})();
