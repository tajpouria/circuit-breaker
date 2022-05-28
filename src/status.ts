import EventEmitter from "events";
import { Logger } from "./logger";
import { StatusBucket } from "./types";

const WINDOW = Symbol("window");
const BUCKETS = Symbol("buckets");
const TIMEOUT = Symbol("timeout");
const BUCKET_INTERVAL = Symbol("bucket-interval");
const LOGGER = Symbol("logger");

/**
 * Constructs a {@link Status}.
 *
 * @class Status
 * @extends EventEmitter
 * @param {Boolean} debug Enable/disable debug logging.
 * @param {Number} resetTimeout Bucket window duration.
 */
export class Status extends EventEmitter {
  constructor(resetTimeout: number, debug: boolean = false) {
    super();

    // Set up our statistical rolling window
    this[BUCKETS] = 3;
    this[TIMEOUT] = resetTimeout;
    this[WINDOW] = new Array(this[BUCKETS]);
    this[LOGGER] = new Logger(Status.name, debug ? 2 : 1);

    // Prime the window with buckets
    for (let i = 0; i < this[BUCKETS]; i++) this[WINDOW][i] = this.bucket();

    // Rotate the buckets periodically
    const bucketInterval = Math.floor(this[TIMEOUT] / this[BUCKETS]);
    this[BUCKET_INTERVAL] = setInterval(this.nextBucket, bucketInterval);

    // No unref() in the browser (Jest open handlers)
    if (typeof this[BUCKET_INTERVAL].unref === "function")
      this[BUCKET_INTERVAL].unref();

    this[LOGGER].debug(
      `Initialized with following window: ${JSON.stringify(
        this[WINDOW],
        null,
        1,
      )}`,
    );
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
   * Increment the first bucket property.
   * @param property Bucket property to increment
   * @returns {void}
   */
  increment = (property: keyof StatusBucket): void => {
    this[LOGGER].debug(
      `Incrementing the '${property}' count of the first bucket`,
    );
    this[WINDOW][0][property]++;
  };

  /**
   * Shift the rolling window to the left.
   * @returns {void}
   */
  private nextBucket = (): void => {
    this[WINDOW].pop();
    this[WINDOW].unshift(this.bucket());
    this[LOGGER].debug(
      `Window After rotation ${JSON.stringify(this[WINDOW], null, 1)}`,
    );
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
  });
}
