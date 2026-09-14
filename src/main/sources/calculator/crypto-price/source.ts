import type { ActionDefinition } from "../../../types.ts";
import { CachedActionSource } from "../../base.ts";
import { fetchCryptoPrices } from "./fetch.ts";
import { cryptoEnabled, setCryptoPrices } from "./store.ts";

/** Crypto moves fast — refresh at most every 10 minutes (on launcher show). */
const REFRESH_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Live crypto prices for the `currency` evaluator — the crypto twin of
 * `ExchangeRateSource`: a `CachedActionSource` that contributes no actions and
 * pushes each fetch into `store.ts`. Skips the network entirely while the
 * user has crypto prices turned off.
 */
export class CryptoPriceSource extends CachedActionSource {
  readonly id = "crypto-price";
  protected refreshThrottleMs = REFRESH_THROTTLE_MS;

  private readonly fetcher: () => Promise<Record<string, number>>;

  constructor(
    fetcher: () => Promise<Record<string, number>> = fetchCryptoPrices,
  ) {
    super();
    this.fetcher = fetcher;
  }

  provide(): Promise<ActionDefinition[]> {
    return Promise.resolve([]);
  }

  owns(): boolean {
    return false;
  }

  /** The user just turned crypto prices on — fetch now instead of waiting out the throttle. */
  refreshNow(): Promise<void> {
    return this.runFetch();
  }

  protected async fetch(): Promise<ActionDefinition[]> {
    if (!cryptoEnabled()) return [];
    setCryptoPrices(await this.fetcher());
    return [];
  }
}
