# Circuit Breaker

A zero-dependency Node.js circuit breaker that executes asynchronous functions and monitors their execution status. When things start failing, circuit breaker plays dead and fails fast.

## Usage

```ts
import CircuitBreaker from "circuit-breaker";

(async () => {
  const breaker = new CircuitBreaker(AsyncAction, {
    timeout: 100,
    maxFailures: 3,
    resetTimeout: 3000,
    debug: true,
  });

  // Initially, breaker must be in the CLOSE state
  await breaker.fire(...args);

  // Reject the promise $maxFailures times to OPEN the breaker
  for (let i = 1; i <= breaker.options.maxFailures; i++)
    await breaker.fire(...args).catch(() => {});

  // Breaker must be in the OPEN state for the next $resetTimeout milliseconds
  breaker.fire(...args).catch(() => {});

  // Wait for $resetTimeout milliseconds
  await sleep(breaker.options.resetTimeout);

  // Resolve the promise 1 time to CLOSE the breaker
  await breaker.fire(...args);

  // Breaker must be in the CLOSE state
  for (let i = 1; i <= breaker.options.maxFailures - 1; i++)
    breaker.fire(...args).catch(() => {});

  // Resolve the promise 1 time to CLOSE the breaker
  await breaker
    .fire(...args, (breaker.options.timeout as number) + 1)
    .catch(() => {});
})();
```

Readme sample can be found in the [example](./example).

## Configuration Options

| Property       | Type                  | Explanation                                                                                                                                  | Default Value        |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `timeout`      | `Number` \| `Boolean` | The time in **milliseconds** that action should be allowed to execute before timing out. Timeout can be disabled by setting this to `false`. | `10000` (10 seconds) |
| `maxFailures`  | `Number`              | The number of times the circuit can fail before opening.                                                                                     | `10`                 |
| `resetTimeout` | `Number`              | The time in **milliseconds** to wait before setting the breaker to `halfOpen` state, and trying the action again.                            | `10000` (10 seconds) |
| `debug`        | `Boolean`             | Enable/disable debug logging.                                                                                                                | `false`              |

## How is it tracks the circuit breaker status?

The [Status](./src/circuit.ts) class, Tracks execution status for a given circuit breaker.
It listen for all events on the circuit breaker and track them in a rolling statistical window.
The window consists of an array of Objects like this:

```ts
[
  { failures: 0, successes: 0, rejects: 0, fires: 0, timeouts: 0 },
  { failures: 0, successes: 0, rejects: 0, fires: 0, timeouts: 0 },
  { failures: 0, successes: 0, rejects: 0, fires: 0, timeouts: 0 },
];
```

Each representing the counts for a circuit breaker events.

## Local Development

Clone the repository, and navigate into it.

Install development dependencies:

```sh
yarn
```

Make your changes, then run tests:

```sh
yarn test
```

## License

[MIT License](./LICENSE)
