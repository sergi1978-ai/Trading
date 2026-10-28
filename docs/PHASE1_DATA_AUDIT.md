# LONG AI PROFIT · Phase 1 data parity audit (2026-10-28)

Status: **EXPERIMENTAL — NOT APPROVED FOR MERGE OR TRADING**

## Confirmed findings in existing code
- `api/backtest.js` requests Alpaca `1Day`, `feed=iex`, `adjustment=split`: the current backtest is a daily proxy, NOT Pine 1D/4H/1H.
- `api/scan.js` requests multiple timeframe bars and has a fallback `aggregateFourHourFromHourly` that emits only complete groups of four hourly bars and drops a remaining partial group.
- `latestCompleted()` determines the current day with an approximate elapsed-time threshold, not a canonical NYSE market calendar.
- The scanner can select SIP historical data and fall back to IEX; mixed feed provenance must be recorded and NOT compared as identical volume.
- The pilot backtest updates equity/drawdown only on closed trades, not mark-to-market.

## Implemented on this branch
- Pure audit/reconstruction module: rejects duplicate timestamps, invalid OHLCV, invalid slots, incomplete sessions and bars unexpected on early-close dates.
- NY timezone handled via IANA `America/New_York`; crypto UTC.
- A full US stock regular session is modeled as 4h plus 2.5h, **not two 4h candles**. The current field is named `fourHour` for API compatibility but must carry a `durationMinutes` field before UI/Pine parity is claimed.
- Optional `earlyCloseDates` must come from an independently verified exchange calendar (not hardcoded guesses).
- Synthetic tests exercise standard/DST hours, 13:00 ET close, duplicates, missing candles and future-bar exclusion.

## Critical limits / next actions
1. No real Alpaca 1Hour or NYSE calendar response was obtained: the connected provider returned an internal error. **Live data parity is unverified.**
2. Validate whether Alpaca's stock `1Hour` candles actually open at 09:30, 10:30, etc.; if not, reconstruct from `1Min` bars with exact 09:30–16:00 ET session boundaries, including short final segment. Do not force incompatible feed bars into this contract.
3. Implement official holiday/early-close calendar, and label shortened blocks as 150-minute rather than 240-minute candles.
4. Compare aggregated daily OHLCV vs same-feed Alpaca native 1Day on split-consistent prices; publish per-bar diff report.
5. Show per-symbol feed, adjustment, completeness, sessions and mismatches in laboratory diagnostics.
6. Do not wire this module into `api/scan.js` or `api/backtest.js` until tests and real-data fixtures are verified.
7. GitHub Actions test results have not been confirmed through the connector. Do not report tests as passing.
