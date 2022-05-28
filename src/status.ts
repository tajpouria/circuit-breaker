import EventEmitter from "events";
import { StatusBucket } from "./types";

const WINDOW = Symbol("window");
const BUCKETS = Symbol("buckets");
const TIMEOUT = Symbol("timeout");
const BUCKET_INTERVAL = Symbol("bucket-interval");

/**
 * Tracks execution status for a given {@link CircuitBreaker}.
 *
 * A Status instance will listen for all events on the {@link CircuitBreaker}
 * and track them in a rolling statistical window. The window consists of
 * an array of Objects, each representing the counts for a {@link CircuitBreaker}'s events.
 *
 * @class Status
 * @extends EventEmitter
 */
export class Status extends EventEmitter {
  constructor() {
    super();

    // Set up our statistical rolling window
    this[BUCKETS] = 10;
    this[TIMEOUT] = 10000;
    this[WINDOW] = new Array(this[BUCKETS]);

    // prime the window with buckets
    for (let i = 0; i < this[BUCKETS]; i++) this[WINDOW][i] = this.bucket();

    // rotate the buckets periodically
    const bucketInterval = Math.floor(this[TIMEOUT] / this[BUCKETS]);
    this[BUCKET_INTERVAL] = setInterval(this.nextBucket, bucketInterval);

    // No unref() in the browser (Jest open handlers)
    if (typeof this[BUCKET_INTERVAL].unref === "function")
      this[BUCKET_INTERVAL].unref();
  }

  /**
   * Get the cumulative stats for the current window.
   * @returns {StatusBucket}
   */
  get stats(): StatusBucket {
    const totals = this[WINDOW].reduce((acc, val) => {
      if (!val) return acc;

      Object.keys(acc).forEach((key) => {
        acc[key] += val[key] || 0;
      });

      return acc;
    }, this.bucket());

    return totals;
  }

  /**
   * Increment a bucket property.
   * @param property Bucket property to increment
   * @returns {void}
   */
  increment = (property: keyof StatusBucket): void => {
    this[WINDOW][0][property]++;
  };

  /**
   * Switch the first bucket to `open` circuit.
   * @returns {void}
   */
  open = (): void => {
    this[WINDOW][0].isCircuitBreakerOpen = true;
  };

  /**
   * Switch the first bucket to `close` circuit.
   * @returns {void}
   */
  close = (): void => {
    this[WINDOW][0].isCircuitBreakerOpen = false;
  };

  /**
   * Shift the rolling window to the left.
   * @returns {void}
   */
  private nextBucket = (): void => {
    this[WINDOW].pop();
    this[WINDOW].unshift(this.bucket());
  };

  /**
   * Create a bucket.
   * @returns {Bucket}
   */
  private bucket = (): StatusBucket => ({
    failures: 0,
    successes: 0,
    rejects: 0,
    fires: 0,
    timeouts: 0,
    isCircuitBreakerOpen: false,
  });
}
