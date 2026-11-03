# Learning Lab v5.28.1 — release gates (2026-11-03)

The experimental interface is functional, but **not** a validated Pine backtest. Do not merge or promote solely because CI and Vercel preview pass.

## Confirmed
- 180-day PLTR retrieval succeeded in a user-observed preview: 5 Alpaca pages, 1,748 source 30m bars, 868 1H, 248 4H, 124 daily.
- Indicator snapshots and partial A/C/E/F pattern diagnostics; no generated trades.
- Automated unit tests and preview builds (check latest commit independently).

## Blocking
- [ ] Compare identical closed 1H timestamps and session/adjustment settings with TradingView LONG AI SWING v5.28.1.
- [ ] Resolve up to 1.6% daily OHLC discrepancy between Alpaca IEX and Yahoo on 10 sampled sessions; inspect dates/fields.
- [ ] Obtain/verify consolidated US volume for RVOL, or explicitly implement a separately calibrated IEX-only strategy (not Pine parity).
- [ ] Reconstruct confirmed 4H/1D context, benchmark SPY/QQQ/BTCUSD, relative strength, and market filters without lookahead.
- [ ] Implement exact A/C/E/F scores and readiness/tactical/probe states with source-to-source regression fixtures.
- [ ] Implement Pine-style entry/exit replay including fees, 2-tick slippage, partial exits, BE/trailing, max hold and cooldown.
- [ ] Run out-of-sample and walk-forward tests, check false positives/negatives and report results by symbol.
- [ ] Verify API time budget and error behavior at 180 and 365 days; no incomplete history silently accepted.
- [ ] Review security and UX before any production merge.

## Release rule
Keep production unchanged. Preview READY and unit tests green are necessary but insufficient for trading-signal parity.
