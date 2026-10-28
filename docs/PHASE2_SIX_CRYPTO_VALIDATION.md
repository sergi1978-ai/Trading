# LONG AI PROFIT v1.0 · Six-market study and decision record

Date of study: 2026-10-28. Read-only data: Coinbase Exchange public USD spot OHLCV, hourly candles; 4H anchored at UTC 00/04/08/12/16/20; 1D anchored UTC midnight.

Universe **predeclared before reviewing any results**: BTC-USD, ETH-USD, SOL-USD, LINK-USD, ADA-USD, AVAX-USD. All six passed complete source-hour coverage and same-exchange native-daily parity in both checked windows. No losing symbol was removed.

Conditions held fixed: signal thresholds in `lib/profit-signals.js`, 0.5% per trade risk, max three simultaneous positions, 25% portfolio allocation cap per asset, 1.5% aggregate initial risk, 5bps commission and 5bps execution slippage per side, 1.5R partial, 3R final TP, 7-day time stop, 3-day no-impulse stop, stop-first within ambiguous OHLC bar. The open-equity position sizing bug was removed: entries are now sized using only prices and cash known at **bar open**, not the same hour's future closing prices. No one is claiming tick-precise fills.

## Fixed-window results, NOT walk-forward or out-of-sample

Both windows include about 65 days of indicator warmup. Results are **too sparse** to justify real-money trading.

| Engine | Jan 1–Apr 30, 2026: filled / closed | Return | Jul 1–Oct 27, 2026: filled / closed | Return |
|---|---:|---:|---:|---:|
| A · TREND_PULLBACK | 2 / 2 | -0.1850% | 10 / 10 | +0.6682% |
| B · BREAKOUT_RETEST | 1 / 1 | -0.5000% | 0 / 0 | 0% (no sample) |
| C · EARLY_EXPANSION | 10 / 10 | -1.6960% | 8 / 6, 2 open | -1.6715% |
| **Combined** | **11 / 11** | **-1.7305%** | **16 / 14, 2 open** | **-0.1223%** |

Combined portfolio max drawdowns (close-marked equity): 4.0932% (January–April) and 2.2273% (July–October). **These exclude worst intrabar equity excursions** and should not be mistaken for a maximum possible loss. The Jul–Oct combined profit factor was 0.9381; Jan–Apr profit factor 0.5654. The two windows are different, not two independent random draws; do not combine profit factors or treat as statistically conclusive.

### Breakout funnel (July–October; number of eligible chart hours, NOT independent trades)

| Symbol | Recent 4H breakout present | Retest band touched | 1H bullish + volume | Risk-qualified |
|---|---:|---:|---:|---:|
| BTC-USD | 50 | 1 | 0 | 0 |
| ETH-USD | 101 | 30 | 0 | 0 |
| SOL-USD | 69 | 17 | 0 | 0 |
| LINK-USD | 93 | 17 | 0 | 0 |
| ADA-USD | 134 | 12 | 0 | 0 |
| AVAX-USD | 162 | 35 | 3 | 0 |

The three AVAX candidates were rejected by **one invalid stop/risk** and **two insufficient R:R due to overhead resistance**. This is a diagnostic, not a recommendation to lower R:R or volume thresholds. The January–April study had one B signal, which lost money.

## Decisions

1. None of A/B/C is approved for live or paper trading. A remains the **least unsuccessful hypothesis** but also loses in the earlier window.
2. C should stay segregated, **not be included in a default profit-seeking portfolio**, until independent tests show an advantage. This is a conservative governance decision, not a proof that C will always lose.
3. B's no-trade problem is not a broken OHLC feed. It is a restrictive confirmation and plan funnel. Investigate hypotheses only on later unseen data.
4. Keep the Pine reference v6.6.27 unchanged. Pine PROFIT LAB remains experimental and **uncompiled in TradingView**, so there is no bit-exact claim.
5. Collect a larger, unexamined test period with dated asset eligibility and cost sensitivity. Pre-register any new rule changes and reserve a genuinely untouched holdout.
6. Do not promote the experimental engines to `main`, paper trading or production based on these results. The independent `assessProfitReadiness()` gate requires >=100 OUT-OF-SAMPLE closed trades, positive net expectancy, profit factor >=1.2, >=60% positive walk-forward windows, cost stress and Pine/data parity.
7. Stock market backtesting remains outstanding. Coinbase's USD spot results cannot be extrapolated to IEX/SIP/NYSE volume.

## Audit trail

GitHub Actions runs for branch `feat/long-ai-profit-phase2-20261028` with scripts `run-profit-lab.mjs`, `run-profit-universe.mjs` and automated tests. The 2026-01–04 and 2026-07–10 combined results and breakout counters were confirmed via workflow run `40777789384`, no symbol excluded.

No brokerage orders were placed, and no production deployment was made.

## Cost-stress results — no parameter optimization

Return %, strategy A only:

| Historical window | 5bps comm + 5bps slippage each side | 10bps comm + 10bps slippage | 20bps comm + 20bps slippage |
|---|---:|---:|---:|
| Jan–Apr 2026 | -0.1850% | -0.2636% | -0.3226% |
| Jul–Oct 2026 | +0.6682% | -0.2840% | -0.9356% |

Combined A+B+C under the same cost stresses:

| Historical window | 5bps each | 10bps each | 20bps each |
|---|---:|---:|---:|
| Jan–Apr 2026 | -1.7305% | -1.9535% | -2.2969% |
| Jul–Oct 2026 | -0.1223% | -1.1042% | -1.8874% |

**This destroys any near-term approval claim:** even A, which was marginally positive in the second window at optimistic costs, goes negative at doubled costs. There is no validated edge. Do not respond by optimizing these very windows.

## Pine and experimental workflow update

- `pine/LONG_AI_PROFIT_v1_0_LAB.pine` now includes the same experimental >=2R net resistance gate as `lib/profit-signals.js`, using prior completed daily high(60) and a 0.2% cost reserve in the RR check.
- The Pine backtest has **not been compiled or executed in TradingView** in this environment. Treat any claims of exact Pine–JS order parity as unverified.
- `lib/profit-readiness.js` blocks paper trading if data/parity/out-of-sample/stress criteria are missing; **never authorizes live orders**.
- Costs here are synthetic; exact Coinbase trading fee tiers, spread, stop execution and broker fills vary by account and liquidity.
