# LONG AI PROFIT v1.1 · Decision record and parity limits

**Status: LAB ONLY. Neither Pine nor Trading 2026 production is changed.**

## Fixed hypothesis before the new data comparison

The July–October 2026 and January–April 2026 v1.0 results were not used to tune a search for winning indicator values. The single v1.1 hypothesis is a **recent pullback and closed 1H reclaim** in a multi-timeframe uptrend:

- Previous **closed daily bar** above rising EMA50 (EMA50 now > EMA50 five daily candles ago).
- Previous **closed 4H** above EMA50, EMA20 above EMA50 and rising over three completed 4H bars.
- Minimum of the past three **completed 4H bars** must be in the EMA20/EMA50 support area (0.25 ATR above EMA20, 0.5 ATR below EMA50).
- One closed 1H bar must reclaim EMA20, finish bullish and above prior 1H high, after one of the preceding four 1H candles had a low below the current 1H EMA20.
- RSI14 (Wilder) 52–70, 1H relative volume >=1.2 of preceding 20 completed bars, previous 20 daily mean `close*volume` >=1 million USD.
- Current close no more than 1.5 ATR4H above EMA20 4H.
- Entry: stop above 1H confirmation high by one tick; expires after three hours; do not chase by more than 0.2 ATR4H.
- Stop: min of recent confirmed 4H and preceding four 1H lows plus current low, less 0.2 ATR4H. Risk cap 10% of entry distance (portfolio sizing remains 0.5% of capital).
- Room to 60-day confirmed daily resistance >=2R after a fixed 0.2% quote-cost reserve when overhead resistance exists.
- The existing simulator still manages 50% TP at 1.5R, remaining TP at 3R, 2x ATR trailing after TP1, and time exits at 3 and 7 days.

**No search grid, dynamic parameter optimizer or cherry-picked winning symbols** is used.

## New historical comparison (source-clean window)

The first requested sample June 1–Dec 31 2025 was rejected correctly: **all six Coinbase symbols had an unresolved missing five-hour block on 2025-10-25, 16:00–20:00 UTC**. No fake fills were inserted. We selected the contiguous **March 1–September 30 2025** window based only on this source completeness issue, prior to seeing any candidate performance results.

Universe: BTC-USD, ETH-USD, SOL-USD, LINK-USD, ADA-USD, AVAX-USD. All six passed 1H completeness and native 1D same-source checks.

| Simulation, same six instruments, pooled 10,000 USD | A v1.0 | A v1.1 |
|---|---:|---:|
| Candidate signals | 100 | 60 |
| Entries accepted | 35 | 23 |
| Closed trades | 35 | 23 |
| Return 5bps commission + 5bps slippage **per side** | -1.5267% | **+0.5920%** |
| Profit factor (base) | 0.8488 | 1.1066 |
| Max closed-bar equity drawdown | 6.2382% | 4.0550% |
| Average realized R (base) | -0.0736 | -0.0045 |
| Return 10bps commission + 10bps slippage each side | -2.3817% | **-0.2159%** |
| Return 20bps commission + 20bps slippage each side | -3.9727% | **-2.1346%** |

**Interpretation:** the A v1.1 hypothesis performs better than A v1.0 *within this sample*, but does NOT meet the original 1.2 net profit factor criterion, does NOT have a demonstrably positive average R, and loses money at doubled trading costs. 23 trades is not statistically compelling. No live or paper authorization.

The period is a chronological additional sample, not a fully untouched future walk-forward test. Using this result to alter v1.1 thresholds would contaminate it for later testing.

## Technical parity

- JS: `lib/trend-pullback-v11.js` isolates 1H confirmation, 4H/1D known at 1H OPEN, logs decision gates and outputs compatible signals for the same portfolio simulator as v1.0.
- Pine: `pine/LONG_AI_PROFIT_v1_1_A_LAB.pine` expresses the same signal hypothesis for the Strategy Tester. Its EMA/RSI/ATR/window conventions are designed to align with JS. **Not compiled or run inside TradingView yet**, so cannot claim exact matched signals.
- The Pine broker emulator and JS may differ in stop-limit gap handling, partial profit execution and trailing stop timing. These need execution-by-execution cross-validation on the same source.
- For US stocks, JS **blocks signal eligibility** until an explicitly validated NYSE regular-session and 4H parity basis is supplied. We cannot borrow Coinbase 24/7 candle rules for NVDA/UBER/MU.
- JS `asOf` protects against using a still-open 1H candle as a confirmed trade signal; the historical harness uses fully closed bars.
- In both implementations, score of a candidate is not the modeled probability of profit.

## Current go / no-go

**NO GO for deploying or merging**. The next technically meaningful tasks are:
1. Compare Pine vs JS **on the same Coinbase BTCUSD 1H closed candles** by date/time and gate reason; compile Pine script and inspect TradingView Strategy Tester.
2. Design a locked *forward* walk-forward evaluation after current calibration, with separate 2025/2026 training and held-out later dates; minimum 100 completed out-of-sample trades across approved assets as an indicative evidence requirement.
3. In parallel, gather complete NYSE regular-session 1-minute data and verified 4H session boundaries for stocks, including splits and earnings gaps; run a separate equities test.
4. Compare execution-cost stress using a fee schedule relevant to the eventual chosen broker and order type.
5. Only then consider whether any strategy is eligible for paper trading. Keep the existing v6.6.27 and Trading 2026 main unchanged.

## Verification

GitHub Actions workflow `profit-v11.yml` test suite and the fixed Coinbase validation (see the PR check logs). No broker orders, no production deployment.
