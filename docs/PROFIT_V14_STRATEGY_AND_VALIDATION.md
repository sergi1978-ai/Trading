# LONG AI PROFIT v1.4 — Experimental three-route Pine lab

**Decision: LAB ONLY. Not a profitable strategy validated, not ready for real orders or production.**

## Why a new version?

2026-10-29 user screenshots of COINBASE:BTCUSD 1H showed the v1.3.1 A pullback mode generated only a couple of entries on the displayed multi-month chart while missing visually apparent momentum phases. The limiting code requires daily trend >EMA20/50, 4H EMA20/50 slope, ADX/DI, 4H MACD improvement, RVOL>=1.1, 4H support touch and 1H reclaim all in a very short time window. This makes the entry gate highly restrictive, but a visually rising candle is not evidence of an exploitable trade.

## Version 1.4 hypotheses, not fitted to screenshots

The **three distinct** Strategy Tester modes are selected manually and never combined in one reported backtest:

- **A · RETROCES:** 1H reclaim after a visit to 4H EMA20 support within the prior twelve closed 1H candles. A prior 1H EMA20 dip is required; the reclaim is at 1H candle close.
- **B · RUPTURA-RETEST:** records a confirmed closed 1H break above the preceding twenty 1H highs with RVOL>=1.2, then requires a distinct subsequent retest within twelve 1H bars.
- **C · CONTINUACIO:** a new research hypothesis, eight 1H candle consolidation followed by bullish breakout, RSI 52–76 and RVOL>=1.1. This is NOT the previous negative-return Early Expansion strategy.

Shared context is less redundant, not absent: previous 1D close above EMA50 and improving EMA50; previous 4H close above EMA50 and near bullish EMA alignment; at least two of four independent checks (ADX/DI, MACD histogram slope, 4H price slope, 4H RVOL). For C continuation require at least three. Volume and RSI are route-specific. ATR controls no-chase distance and stop buffer. Weekly trend, VWAP and Bollinger are information only; the latter are not mandatory to avoid score duplication.

No Pine higher-timeframe `request.security` expression uses developing bars; the code uses `[1]` and `lookahead_on` to prevent historical future leakage.

## Risk, exit, limitations

- 0.5% **target risk** per trade, max 25% notional allocation and max stop distance 10%; stop gaps, stop-limit execution and fees can cause more loss.
- Stop-limit entry priced near confirmation high, max chase 0.2x 4H ATR, valid for three hourly bars. Cooldown eight bars after closing.
- Stop-first protective two-stage exits: TP1 50% at +1.5R and TP2 remainder at +3R; trailing stop only after TP1 actual profit, never after STOP_1.
- Pending brackets, time exit after seven days, no-progress review after three days and cleanup below $1 notional; broker emulator and real liquidity differ.
- Chart is fixed at **standard COINBASE:BTCUSD 1H** for first test. Until RTH 4H alignment is validated, the script fails closed on stocks.
- Panel reports blocking reasons (regime, setup, stop/RR), but these are bar counts, **not independent missed winning trades**.
- No v1.4 JavaScript equivalent has been validated yet. Do not claim Pine/Trading 2026 parity or deploy to `main`.

## Validation gates

1. GitHub static checks plus existing simulation regressions. These tests **do not compile Pine**.
2. Manual Pine Editor compilation using user TradingView account and default 10,000 USD capital.
3. Test A, B, C independently, on **the same Coinbase BTCUSD** one-hour dates and settings, report positions vs partial exits, total return, drawdown, profit factor and cost sensitivity.
4. Compare frozen v1.4 on ETH/SOL and market regimes without changing rules to fit August/October screenshots.
5. Port same routes to JS on 1H/4H/1D Coinbase OHLCV; demand signal and execution parity before including them in Trading 2026 LAB.
6. Only after forward independent sample adequate and realistic fees, consider paper testing. No live trading approval.

## Exact source

`pine/LONG_AI_PROFIT_v1_4_LAB.pine`, PR branch `feat/long-ai-profit-v1-4-three-routes-20261029`.
