# Coinbase BTC-USD — real historical parity audit

Date: 2026-10-28. Source: **Coinbase Exchange public** `GET /products/BTC-USD/candles`, 1H (`granularity=3600`) and 1D (`granularity=86400`), without authentication. Executed read-only in GitHub Actions on the isolated audit branch.

The API does not offer 4H candles directly: the 4H series below is derived by grouping 4 *completed* 1H periods at UTC 00:00/04:00/08:00/12:00/16:00/20:00.

| UTC day | 1H bars / 24 | 4H groups / 6 | 1H-aggregated daily OHLC vs native daily | Native daily BTC volume | Volume difference 1H vs daily |
|---|---:|---:|---|---:|---:|
| 2026-10-23 | 24 | 6 | EXACT | 4,904.75790284 BTC | 0% |
| 2026-10-24 | 24 | 6 | EXACT | 3,705.20481407 BTC | ~0% |
| 2026-10-25 | 24 | 6 | EXACT | 2,077.13196666 BTC | +0.1641845% |
| 2026-10-26 | 24 | 6 | EXACT | 6,746.31852811 BTC | 0% |
| 2026-10-27 | 24 | 6 | EXACT | 4,356.18246596 BTC | 0% |

Total: 120 complete 1H bars, 30 4H derived bars, 5/5 daily OHLC identical. Coinbase-specific volume is substantially more useful than the sparse Alpaca Crypto US feed for the intended BTCUSD product, **but do not call it the global Bitcoin volume**.

### Concrete BTCUSD reference prices

Coinbase 2026-10-27 daily: O 80008.79, H 81182.00, L 79365.93, C 80799.51 USD. The rebuilt 1H daily OHLC was identical.

### Pine reference in conversation

The user supplied LONG AI ASSISTANT v6.6.27 source and screenshot of COINBASE:BTCUSD in TradingView, chart 1H, 28 October 2026 around 21:39 UTC. Panel:
- `EXP · PROP RUPTURA` (watch only);
- Entry quality 55/100, not confirmed;
- Potential 75/100, a heuristic, not success probability;
- 1.9R vs required 2R, and `SENSE PLA EXECUTABLE`.

The screenshot's 1H candle was **still open**, so comparing its intrabar price/volume to a completed historical candle would be misleading. The exact Pine time series may also differ if Coinbase TradingView uses different candle revisions.

### Work product

- `lib/pine-v6627-parity.js`: standalone read-only core entry logic, with bar-open HTF offset and closed 1H gate.
- `test/pine-v6627-parity.test.js`: EMA/ATR, no-lookahead, hourly/bar boundary tests.
- `scripts/verify-coinbase-parity.mjs`: read-only public Coinbase check.
- `docs/PHASE1_PINE_V6627_PARITY.md`: detailed mapping of exact Pine gates and mismatches in `api/scan.js`.

### Quality gates

- Coinbase 1H -> daily native parity verified for the 5 days above, including one 0.164% volume difference.
- Coinbase 4H vs native TradingView Coinbase 4H **NOT independently verified**, because Coinbase's public endpoint has no native 4H candle and no direct TradingView export.
- Pine numerical indicator and READY parity against TradingView values **NOT yet demonstrated**. The parity module is an independently testable implementation of supplied rules, not a certified bit-exact translation of Pine.
- No production `main` merge or deployment authorized by this check.
