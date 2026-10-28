# UBER Alpaca IEX: real minute/day/hour parity (28 Oct 2026)

Source: connected Alpaca get_stock_bars calls for 1Min, 1Hour, 1Day; IEX feed. Days 2026-10-20–23. Only 09:30–16:00 New York (13:30–20:00 UTC) 1-minute candles included.

| Session | RTH minute bars / 390 | O/H/L/C match native 1D? | First 1H open vs true day open | Volume deviation 1Min vs 1Day |
|---|---:|---|---|---:|
| 2026-10-20 | 388 | YES | 69.29 / 69.15 USD | -649 (-0.0645%) |
| 2026-10-21 | 387 | YES | 68.9 / 68.9 USD | -937 (-0.1049%) |
| 2026-10-22 | 385 | YES | 67.46 / 67.46 USD | -1484 (-0.1229%) |
| 2026-10-23 | 388 | YES | 67.92 / 68.36 USD | -872 (-0.084%) |

**Findings:** Daily OHLC all match on 4 of 4 days, but volume does not match exactly. Native hourly candles are clock-anchored at 09:00 ET rather than open-anchored at 09:30 ET, so they cannot be used as an equivalent basis for our session-anchored 4H. Native 1H opening differs from daily opening on October 20 and October 23.

**Scope:** single stock, IEX feed, four sessions; not yet TradingView/Pine parity. Minute bars may be absent for minutes with no IEX trades; do not forward-fill prices. Native daily volume differences may arise from aggregation rules or late trade updates and require separate diagnostics.

## Verifiable compact numeric evidence
```json
[
  {
    "date": "2026-10-20",
    "minutes": 388,
    "native": {
      "o": 69.15,
      "h": 69.745,
      "l": 68.42,
      "c": 68.91,
      "v": 1005758
    },
    "rebuilt": {
      "o": 69.15,
      "h": 69.745,
      "l": 68.42,
      "c": 68.91,
      "v": 1005109
    },
    "hourlyFirstOpen": 69.29,
    "volumeDelta": -649,
    "volumeDeltaPct": -0.0645,
    "ohlcMatch": true
  },
  {
    "date": "2026-10-21",
    "minutes": 387,
    "native": {
      "o": 68.9,
      "h": 69.18,
      "l": 67.36,
      "c": 67.62,
      "v": 893613
    },
    "rebuilt": {
      "o": 68.9,
      "h": 69.18,
      "l": 67.36,
      "c": 67.62,
      "v": 892676
    },
    "hourlyFirstOpen": 68.9,
    "volumeDelta": -937,
    "volumeDeltaPct": -0.1049,
    "ohlcMatch": true
  },
  {
    "date": "2026-10-22",
    "minutes": 385,
    "native": {
      "o": 67.46,
      "h": 69.145,
      "l": 67.4,
      "c": 69.05,
      "v": 1207784
    },
    "rebuilt": {
      "o": 67.46,
      "h": 69.145,
      "l": 67.4,
      "c": 69.05,
      "v": 1206300
    },
    "hourlyFirstOpen": 67.46,
    "volumeDelta": -1484,
    "volumeDeltaPct": -0.1229,
    "ohlcMatch": true
  },
  {
    "date": "2026-10-23",
    "minutes": 388,
    "native": {
      "o": 68.36,
      "h": 68.86,
      "l": 66.43,
      "c": 66.67,
      "v": 1037804
    },
    "rebuilt": {
      "o": 68.36,
      "h": 68.86,
      "l": 66.43,
      "c": 66.67,
      "v": 1036932
    },
    "hourlyFirstOpen": 67.92,
    "volumeDelta": -872,
    "volumeDeltaPct": -0.084,
    "ohlcMatch": true
  }
]
```

**Decision: Not deployed.**

## Additional native 4Hour check (Alpaca IEX)
- Alpaca returned eight native 4Hour UBER candles for 20–23 October: two per session, with UTC starts at **12:00 and 16:00** (08:00 and 12:00 ET).
- For **20 October**, Alpaca's first native 4Hour bar starts at 12:00 UTC, opens at **$69.29**, and closes at **$68.835**.
- Our session-anchored first 240-minute block starts at **13:30 UTC** (09:30 ET), opens at **$69.15** and closes at **$68.985**.
- These are different time windows, not a numerical computation error. Never compare them as if they described the same interval.
- The 4Hour construction intended for TradingView Pine is still **unverified**; TradingView symbol/feed/chart session settings and its exact 4H boundaries must be captured for true parity.

## Automated executable implementation
- `lib/minute-parity.js`: calendar-anchored session reconstruction from 1Min and per-session coverage diagnostics.
- `test/minute-parity.test.js`: offline deterministic test suite, with 12 tests passing locally using Node 22.
- `scripts/verify-live-ohlcv.mjs`: repeatable read-only Alpaca test requiring ALPACA_API_KEY and ALPACA_API_SECRET; this script was **not run** here because the credentials are held by the connected service, not the local runtime.
- GitHub CI status not confirmed as passing. Branch/PR still experimental; no production merge.
