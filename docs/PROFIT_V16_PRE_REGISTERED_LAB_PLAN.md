# LONG AI PROFIT v1.6 LAB — experiments preregistrats

Data: 2026-10-29. **LAB ONLY: no verified Pine compiler, no historical 1.6 profitability, no broker orders or Trading 2026 production integration.**

## Evidence and constraints

The 2025-01-01 to 2026-10-29 UTC historical Binance pipeline was checked across BTCUSDT, ETHUSDT and SOLUSDT: 15,984 one-hour bars per asset, 3,996 four-hour native crosschecks and 666 daily crosschecks per asset, all consistent. This demonstrates data consistency, NOT any profitable strategy. Long AI v1.4 A/B were losing on inspected BTC history. v1.4 C earned just +$15.32 across only three distinct positions; v1.5 C was subsequently reported as negative. Therefore no prior motor has a statistically established positive edge.

## Fixed hypotheses — one route per test
- **C CONTINUACIO**: after eight prior 1H bars form a tight consolidation, close above their high with rising 1H candle, positive RVOL and moderate RSI. Requires confirmed D/4H bullish regimes.
- **B RUPTURA-RETEST**: store a confirmed breakout above the preceding 20 1H highs with volume, wait for a separately closed later 1H candle to retest and reclaim the level within twelve hours. No same-bar hindsight retest.
- Both require 2 of three complementary confirmations on closed 4H candles: DI+>DI- with ADX>=16, non-decreasing MACD histogram, improving 4H close. Weekly EMA, VWAP and Bollinger width are NOT additional trade gates.
- D/4H data use `request.security(... [1],lookahead_on)`; no 4H realtime or daily partial candle is used in historical signal logic.
- BTC filter optional/informative by default, with Binance BTCUSDT as reference. A CMC current market snapshot or TradingCursor prose must never be turned into historical entry data. Historical prices are from the chart exchange (BINANCE BTCUSDT is different from COINBASE BTCUSD).

## Position/execution
- Standard 1H crypto USD/USDT only; explicit rejection for stock charts (RTH stock reconstruction unfinished).
- Start/end date inputs: inclusive 2025-01-01T00:00Z to exclusive 2026-10-29T00:00Z, labeled **examined history (not independent holdout)**. Change to future dates only for prospective paper-forward validation.
- Each strategy is separately selected and separately backtested, never conflate B and C capital returns.
- Up to 0.5% estimated account risk per position inclusive of a conservative estimated round-trip reserve (0.2% of entry) with max 25% equity notional exposure; risk may be exceeded by fills, gaps and fee differences. Quantities round down to instrument `syminfo.mincontract`.
- One stop-limit buy at confirmed 1H signal bar high+tick, limit max 0.20*4H ATR above trigger, expires after 3×1H bars if unfilled; cooldown 8×1H bars after exit.
- Crucial fix: place `strategy.exit(stop=...,limit=...)` in the SAME conditional block as `strategy.entry`, on the signal bar, so bracket exists when the simulated entry fills (rather than first appearing one bar after fill). TradingView documents same-bar stop/target bracket behavior.
- A SINGLE full-position stop/target bracket, stop below recent structure with 0.2*4H ATR buffer, maximum stop 8% of trigger, target theoretical 2R; no partial TP1/TP2/dust, no trailing based on unconfirmed OHLC.
- Date exits: 7-day time-stop, and exit for lack of +0.5R progress after 3 days; do not count high of entry bar as post-fill MFE, because fill timing is unknown. This is not a validated alpha rule.
- When a real prior 60-day resistance lies above current trigger, require enough room to theoretical 2R after estimated costs. Otherwise label resistance as "not identified", not fake 3R available.
- The panel provides per-leg-free trade count, exit reasons, excursions (MFE/MAE), net P/L, profit factor, and blockers by bar (not missed winning trades).

## Research protocol (TradingLab PDF + Binance validation)

1. Pine Editor **must compile manually**: load `pine/LONG_AI_PROFIT_v1_6_LAB.pine` in a NEW script; standard `BINANCE:BTCUSDT` 1H; preserve old scripts; report Pine errors if any. GitHub node tests cannot compile Pine.
2. Fix strategy window, capital $10k, fees and settings. Run C then B individually. Record unique entries and full exits (no partial legs), net return, PF, drawdown, R outcome, win/loss and brokerage costs. Do not infer outperformance simply because signals increased.
3. Compare C and B at BTCUSDT, ETHUSDT, SOLUSDT, using the *same exchange*, exactly reconstructed 1H/4H/D. JS simulator reproducing v1.6 rules **does not yet exist**, so Pine-to-JS fill/signal parity is NOT confirmed. Historical comparisons on 2024–2026 examined data are not independent out-of-sample validation.
4. Stress scenarios: 2× fees, 2× slippage, stop-first ambiguous OHLC, excluding top 5% trade gains, parameter sensitivity ±10/20% as a sensitivity report and NOT a new search, plus chronological later paper-forward sample. Benchmark buy-and-hold separately (different risk profile).
5. Even ≥30 independent positions only provides a provisional sample; do not promote without statistical uncertainty, multiple assets/regimes, robustness to reasonable costs and fills, and prospective evidence. No live trading, no production merge, no automated broker routing.

## References
- TradingView non-repainting HTF: https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/
- TradingView strategy entry/exit broker emulator: https://www.tradingview.com/pine-script-docs/concepts/strategies/
- TradingView strategy exit FAQ: https://www.tradingview.com/pine-script-docs/faq/strategies/
- Previous validation record: `docs/PROFIT_BINANCE_HISTORICAL_RECONSTRUCTION_20261029.md`
- Source: `pine/LONG_AI_PROFIT_v1_6_LAB.pine`
