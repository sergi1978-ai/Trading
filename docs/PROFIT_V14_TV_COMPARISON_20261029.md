# TradingView v1.4 A/B/C comparison — 2026-10-29

Evidence: user-supplied screenshots of TradingView Strategy Tester, 2026-01-01 through 2026-10-29, capital USD 10,000. BTCUSD Coinbase 1H inferred from prior user's chart in this conversation; exact chart is not visible in every metrics screenshot. Screenshots themselves are NOT uploaded to GitHub.

| Metric | A RETROCES | B RUPTURA-RETEST | C CONTINUACIO |
|---|---:|---:|---:|
| Net P&L | -104.06 (-1.04%) | -24.43 (-0.24%) | +15.32 (+0.15%) |
| Gross profit | 157.36 | 0 | 51.31 |
| Gross loss | 261.42 | 24.43 | 35.99 |
| Profit factor | 0.602 | 0 | 1.426 |
| Closed trade records | 32 | 2 | 7 |
| Winning / losing records | 8 / 24 | 0 / 2 | 3 / 4 |
| Maximum equity drawdown | 162.29 (1.62%) | not visible | 50.81 (0.51%) |
| Expectancy (USD; percent as UI reports) | -3.25; -0.53% | -12.22; -0.98% | +2.19; -0.05% |

Important: TradingView may count partial TP1/TP2 exits separately. These numbers are **closed exit legs**, not necessarily distinct opened positions. C expectancy USD positive / percentage negative requires trade-by-trade explanation, not speculation.

A: current rules no-go. PF 0.602 and -104.06 USD after simulated costs. B: only two losing records, too little information for strong inference. C: promising research lead for further tests only; 7 records and a total return of +0.15% over almost ten months are far too little evidence to warrant paper/live deployment.

Code: pine/LONG_AI_PROFIT_v1_4_LAB.pine currently assigns theoretical roomR=3.0 whenever the 60-day resistance does not exceed the trigger. This is an **assumption of headroom**, not an observed resistance-backed RR. Independently inspect this fallback when considering changes. TP1/TP2 use stop/limit legs; label and group actual closed legs before inferring win rate of true positions. Blocker counts are counts of bars, not missed winning opportunities.

Recommended next steps: group trade legs by entry time; inspect worst A losses and C TP1/TP2 exits, stop/trailing and actual vs assumed RR; audit execution mechanics without altering strategy thresholds; freeze A/B/C and test on independently selected dates, multiple cryptos and realistic cost stress before considering production. No live orders or production merge authorized. The v1.4 Pine-JavaScript parity remains unverified.

**Status: A blocked; B inconclusive; C preferred for research, not approved for trading.**
