import EventEmitter from "events";
import { Status } from "./status";
import { CircuitBreakerOptions } from "./types";
import { buildError, ErrorCode } from "./common";

const STATE = Symbol("state");
const OPEN = Symbol("open");
const CLOSED = Symbol("closed");
const HALF_OPEN = Symbol("half-open");
const PENDING_CLOSE = Symbol("pending-close");
const STATUS = Symbol("status");
const RESET_TIMEOUT = Symbol("reset-timeout");

/**
 * Constructs a {@link CircuitBreaker}.
 *
 * @class CircuitBreaker
 * @extends EventEmitter
 * @param {Function} action The action to fire for this {@link CircuitBreaker}
 * @param {Object} options Options for the {@link Options}
 */
export default class CircuitBreaker<
  TI extends unknown[] = unknown[],
  TR = unknown,
> extends EventEmitter {
  /**
   * True if the circuit is currently closed. False otherwise.
   * @returns {Boolean}
   */
  get closed() {
    return this[STATE] === CLOSED;
  }

  /**
   * True if the circuit is currently half opened. False otherwise.
   * @returns {Boolean}
   */
  get halfOpen(): boolean {
    return this[STATE] === HALF_OPEN;
  }

  /**
   * True if the circuit is currently opened. False otherwise.
   * @returns {Boolean}
   */
  get opened(): boolean {
    return this[STATE] === OPEN;
  }

  /**
   * Get the current stats for the circuit.
   * @returns {Object}
   */
  get stats(): Status["stats"] {
    return this[STATUS].stats;
  }

  constructor(
    private action: (...args: TI) => Promise<TR>,
    public options: CircuitBreakerOptions = {},
  ) {
    super();

    // Check if action is defined
    if (!action || typeof action !== "function") {
      throw new TypeError(
        "Cannot construct a CircuitBreaker without an invocable action.",
      );
    }

    // Populate the options
    this.options.timeout =
      options.timeout === false ? false : options.timeout || 10000;
    this.options.resetTimeout = options.resetTimeout || 30000;
    this.options.maxFailures = Number.isInteger(options.maxFailures)
      ? options.maxFailures
      : 10;
    this.options.debug = !!options.debug;

    // Populate the statuses
    this[STATUS] = new Status();
    this[STATE] = CLOSED;
    this[PENDING_CLOSE] = false;

    // Register the listeners

    this.on("success", () => {
      this[STATUS].increment("successes");
      if (this.halfOpen) this.close();
    });
    this.on("failure", () => this[STATUS].increment("failures"));
    this.on("timeout", () => this[STATUS].increment("timeouts"));
    this.on("fire", () => this[STATUS].increment("fires"));
    this.on("reject", () => this[STATUS].increment("rejects"));
    this.on("open", () => {
      this[STATUS].open();
      this.startResetTimer();
    });
    this.on("close", () => this[STATUS].close());
  }

  /**
   * Closes the breaker, allowing the action to execute again.
   * @returns {void}
   */
  close = (): void => {
    if (this[STATE] !== CLOSED) {
      if (this[RESET_TIMEOUT]) {
        clearTimeout(this[RESET_TIMEOUT]);
      }
      this[STATE] = CLOSED;
      this[PENDING_CLOSE] = false;
      /**
       * Emitted when the breaker is reset allowing the action to execute again
       * @event CircuitBreaker#close
       */
      this.emit("close");
    }
  };

  /**
   * Opens the breaker. Each time the breaker is fired while the circuit is
   * opened, a failed Promise is returned, or if any fallback function
   * has been provided, it is invoked.
   * @returns {void}
   */
  open = (): void => {
    if (this[STATE] !== OPEN) {
      this[STATE] = OPEN;
      this[PENDING_CLOSE] = false;
      /**
       * Emitted when the breaker opens because the action has
       * failed more than `options.maxFailures` number of times.
       * @event CircuitBreaker#open
       */
      this.emit("open");
    }
  };

  /**
   * Execute the action for this circuit. If the action fails or times out, the
   * returned promise will be rejected. If the action succeeds, the promise will
   * resolve with the resolved value from action.
   * @returns {Promise<any>} promise resolves with the circuit function's return
   * value on success or is rejected on failure of the action.
   */
  fire(...args: any[]): Promise<any> {
    return this.call.apply(this, [this.action].concat(args));
  }

  /**
   * Execute the action for this circuit using `context` as `this`.
   * If the action fails or times out, the
   * returned promise will be rejected. If the action succeeds, the promise will
   * resolve with the resolved value from action.
   * @param {any} context the `this` context used for function execution
   * @param {any} rest the arguments passed to the action
   * @returns {Promise<any>} promise resolves with the circuit function's return
   * value on success or is rejected on failure of the action.
   */
  call(context: Function, ...rest: any[]): Promise<any> {
    const args = Array.prototype.slice.call(rest);

    /**
     * Emitted when the circuit breaker action is executed
     * @event CircuitBreaker#fire
     * @type {any} the arguments passed to the fired function
     */
    this.emit("fire", args);

    if (!this.closed && !this.halfOpen) {
      /**
       * Emitted when the circuit breaker is open and failing fast
       * @event CircuitBreaker#reject
       * @type {Error}
       */
      const error = buildError(ErrorCode.EOPENBREAKER);

      this.emit("reject", error);

      return Promise.reject(error);
    }
    this[PENDING_CLOSE] = false;

    let timeout: NodeJS.Timeout;
    let timeoutError = false;
    return new Promise((resolve, reject) => {
      if (this.options.timeout) {
        timeout = setTimeout(() => {
          timeoutError = true;
          const error = buildError(ErrorCode.ETIMEDOUT);
          /**
           * Emitted when the circuit breaker action takes longer than
           * `options.timeout`
           * @event CircuitBreaker#timeout
           * @type {Error}
           */
          this.emit("timeout", error, args);
          this.handleError(error, timeout, args, reject);
        }, this.options.timeout);
      }

      try {
        const result = this.action.apply(context, args);
        const promise =
          typeof result.then === "function" ? result : Promise.resolve(result);

        promise
          .then((result: any) => {
            if (!timeoutError) {
              clearTimeout(timeout);
              /**
               * Emitted when the circuit breaker action succeeds
               * @event CircuitBreaker#success
               * @type {any} the return value from the circuit
               */
              this.emit("success");
              resolve(result);
            }
          })
          .catch((error) => {
            if (!timeoutError) {
              this.handleError(error, timeout, args, reject);
            }
          });
      } catch (error) {
        this.handleError(error, timeout, args, reject);
      }
    });
  }

  /**
   * Start the reset timer.
   * @returns {void}
   */
  private startResetTimer = (): void => {
    this[RESET_TIMEOUT] = setTimeout(() => {
      this[STATE] = HALF_OPEN;
      this[PENDING_CLOSE] = true;
      /**
       * Emitted after `options.resetTimeout` has elapsed, allowing for
       * a single attempt to call the service again. If that attempt is
       * successful, the circuit will be closed. Otherwise it remains open.
       * @event CircuitBreaker#halfOpen
       * @type {Number} how long the circuit remained open
       */
      this.emit("halfOpen", this.options.resetTimeout);
    }, this.options.resetTimeout);
  };

  toJSON = (): Record<string, Object> => {
    return {
      state: {
        closed: this.closed,
        open: this.opened,
        halfOpen: this.halfOpen,
      },
      stats: this.stats,
    };
  };

  private handleError = (
    error: any,
    timeout: NodeJS.Timeout,
    args: any,
    reject: Function,
  ): void => {
    clearTimeout(timeout);
    this.fail(error, args);
    reject(error);
  };

  private fail = (error: any, args: any): void => {
    /**
     * Emitted when the circuit breaker action fails
     * @event CircuitBreaker#failure
     * @type {Error}
     */
    this.emit("failure", error, args);
    // check stats to see if the circuit should be opened
    const stats = this.stats;
    if (stats.failures >= this.options.maxFailures || this.halfOpen)
      this.open();
  };
}
