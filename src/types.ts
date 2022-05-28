export interface CircuitBreakerOptions {
  /**
   * The time in milliseconds that action should be allowed to execute before timing out.
   * Timeout can be disabled by setting this to `false`.
   * @default 10000 (10 seconds)
   */
  timeout?: number | false | undefined;

  /**
   * The number of times the circuit can fail before opening.
   * @default 10
   */
  maxFailures?: number | undefined;

  /**
   * The time in milliseconds to wait before setting the breaker to `halfOpen` state, and trying the action again.
   * @default 10000 (10 seconds)
   */
  resetTimeout?: number | undefined;

  /**
   * Enable/disable debug logging.
   * @default false
   */
  debug?: boolean;
}

export interface StatusBucket {
  failures: number;
  successes: number;
  rejects: number;
  fires: number;
  timeouts: number;
}
