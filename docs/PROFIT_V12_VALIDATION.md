# LONG AI PROFIT v1.2 — Experimental decision record

Date: 2026-10-29. Draft PR #15. **LAB ONLY; no production or real orders.**

## Why a v1.2?

October 29 TradingView screenshots confirmed v1.1.1 strategy trades on a chart whose prices were ~1,900–2,700 USD (ticker not visible), including multiple full stops after a transient recovery and very small position remnants after TP1/TP2. The v1.1 JS six-asset Coinbase replay had a small, cost-fragile edge. Rather than retuning old thresholds, v1.2 changes just **one structural market hypothesis** and the Pine exit bookkeeping.

## Hypothesis (registered BEFORE reviewing new 2024-window results)

Retain all v1.1 conditions, prices, 0.5% per-trade risk, 25% exposure cap, exits and cost assumptions. Require additionally, as of **1H OPEN**, on fully closed daily and 4H bars:

- Last daily close above its own EMA20.
- Last 4H close above its EMA20.
- Last 4H close greater than previous completed 4H close.

The JS engine is `lib/trend-pullback-v12.js` which **filters only confirmed v1.1 signals** and records the reason `REGIME_NOT_CONFIRMED`. No new thresholds are searched; if this reduces signals too much or worsens performance, it will not be promoted.

The Pine candidate `pine/LONG_AI_PROFIT_v1_2_LAB.pine` mirrors this context condition, preallocates the two TP amounts in fixed quantities rather than repeating percentage exits, and attempts to close remaining sub-$1 notional as simulation dust. This change affects execution mechanics. **It has not been compiled in TradingView or compared fill-by-fill against JS**, so the residual problem is NOT yet proven fixed.

## Results: fixed six Coinbase USD pairs, same commission/slippage assumptions

### Prior studied 2025-03 to 2025-09 window (six accepted markets)

| Metric | A v1.1 | A v1.2 |
|---|---:|---:|
| Candidate signals | 60 | 30 |
| Accepted entries and closed trades | 23 | 14 |
| Return 5bps comm + 5bps slippage EACH side | +0.5920% | **+0.7275%** |
| Profit factor at base costs | 1.1066 | 1.2178 |
| Mean realized R | -0.0045 | +0.0628 |
| Mark-to-market drawdown on completed bars | 4.0550% | 2.3427% |
| Return 10bps + 10bps each side | -0.2159% | +0.1954% |
| Return 20bps + 20bps each side | -2.1346% | **-0.6926%** |

Do not infer a statistical edge from 14 completed trades.

### Older, previously unexamined 2024-09 to 2025-02 window

Five of the six predetermined markets met strict hourly-to-native-daily price/volume parity. **LINK-USD was excluded** due to a Coinbase source discrepancy on 2024-10-11: aggregated hourly OHLC vs native daily OHLC did not match; volume discrepancy reported ~28.91%. No candles were silently invented. The resulting comparison covers **five markets, not the full registered six**, and is conditional on a data exclusion.

| Metric | A v1.1 | A v1.2 |
|---|---:|---:|
| Candidate signals | 9 | 7 |
| Accepted entries and closed trades | 6 | 4 |
| Return 5bps comm + 5bps slippage EACH side | **+1.5008%** | +0.9341% |
| Profit factor at base costs | 2.4781 | 2.8417 |
| Mean realized R | +0.6819 | +0.7274 |
| Mark-to-market drawdown on completed bars | 0.7509% | 0.7509% |
| Return 10bps + 10bps each side | **+1.2930%** | +0.7803% |
| Return 20bps + 20bps each side | **+1.0060%** | +0.5875% |

The new filter is **not unconditionally better**: older window return falls vs v1.1 because two additional trades are filtered. Four trades is inadequate for robust conclusion. Once this window was inspected it ceased to be untouched future test data.

## Validation limits and safeguards

- 70/70 tests passed in GitHub Actions (includes JavaScript functional, no-lookahead, stock RTH and Pine **static checks**). Static checks are **NOT** TradingView Pine compilation tests.
- The two strategy implementations use different intrabar/order emulators; never claim numerical profit or fill parity without matching signal date/entry/stop/exits on COINBASE:BTCUSD (1H).
- Historical results include 1H candles and a conservative stop-priority approximation; they do not capture all intrabar path risks.
- Brokerage tier fees, spread, latency, and funding (if leveraged) not personalized or modeled.
- No stocks approved yet: NYSE RTH bar parity with Pine still missing.
- No backtest can guarantee future returns. Keep the current production scanner unchanged. The v1.2 Pine is suitable only for **separate compile/Strategy Tester inspection** with no live order routing.
- Further validation must use a chronological genuinely later paper-forward holdout, not additional threshold search over the inspected 2024–2026 windows.

## Project links

- PR #15: https://github.com/sergi1978-ai/Trading/pull/15
- Pine LAB: `pine/LONG_AI_PROFIT_v1_2_LAB.pine`
- JavaScript: `lib/trend-pullback-v12.js`
- CI: `.github/workflows/profit-v11.yml` (inherited suite) and `.github/workflows/profit-v12.yml`

**Release status: BLOCKED.** Pending Pine compilation, matched signal/fill parity, real stock session data, larger cost-robust sample, app UI integration and controlled paper test.
