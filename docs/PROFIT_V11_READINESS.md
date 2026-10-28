# LONG AI PROFIT v1.1 — Readiness / release gates

Status as of **2026-10-28**: **BLOCKED · LAB ONLY**. User has requested notification once ready to apply on Pine and Trading 2026. Do not merge or promote automatically.

| Gate | Current evidence | Status |
|---|---|---|
| JavaScript unit/regression tests | 62/62 PASS on 2026-10-28, including RTH/DST/early-close/missing-minute tests; CI must remain green after all changes | PASS provisional |
| Six crypto symbols and frozen historical replay | 2025-03–09, 6 accepted Coinbase pairs; 23 closed A v1.1 trades | PASS for historical feasibility only |
| Robust net expected return | v1.1 PF 1.1066 (required >=1.2), mean R -0.0045, cost 10bps each side return -0.2159%, 23 trades | **FAIL** |
| Fully out-of-sample / walk-forward | No >=100 OOS closed trades; 2025 results have now been inspected | **MISSING** |
| Pine v1.1 runs inside TradingView | User screenshot 2026-10-28 23:58 Europe/Madrid shows Coinbase BTCUSD 1H with v1.1 Strategy Tester trading history and successful report refresh; partial exits TP1/TP2 visible | **USER-VERIFIED EXECUTION** |
| Pine↔JavaScript same-source signal-by-signal parity | Pine BTCUSD Coinbase confirmed in screenshot; Strategy Tester trade CSV not yet supplied, no identical-interval Pine-to-JS pairwise reconciliation | **MISSING** |
| Stock 1H/4H session reconstruction parity | Alpaca IEX raw 4H includes 12:00 UTC premarket and 20:00 UTC after-hours bars; 1H includes 12:00 UTC premarket. Added RTH 1m reconstruction with DST + partial days but NOT verified against TradingView stock 4H | **MISSING** |
| App integration | `api/backtest.js` still states **DAILY proxy only, NOT a replay of Pine 1D/4H/1H**. `index.html` and `api/scan.js` do **not** import `trend-pullback-v11.js`, `profit-signals.js` or `profit-simulator.js` | **MISSING** |
| Vercel deployment | Latest branch deployments are previews (`target=null`), not a release of the v1.1 module integrated in Trading 2026 | **PREVIEW ONLY** |
| Brokerage / live trade permission | Never authorized by CI success; requires separate explicit user approval, compliance and forward paper execution validation | **BLOCKED** |

## Important interpretation

- PASS of unit tests or Vercel READY means only **code test/build success** and must NEVER be paraphrased as profit proof, TradingView compile parity or actual release availability.
- The research Pine file may be manually pasted in TradingView's Pine Editor for **compilation and Strategy Tester investigation** without live order routing. This is **not an approval to replace** the user's v6.6.27 or to trade.
- TradingView Pine compiler and broker emulator output are inaccessible through this GitHub/Vercel connection. The user must compile it in TradingView, then provide screenshot of compiler result, Strategy Tester trade list or comparable exported results if possible. No paid export required for a few screenshot checkpoints.
- Need real NYSE SIP or adequately verified RTH data (IEX-only coverage may not represent the full market) and independent indicator parity before stock approval.
- To mark eligible for a controlled Trading 2026 paper-testing release: Pine compiles, data source and 4H session parity are established, UI+backend integrate and tag actual version in a preview environment, close-time comparisons and risk/cost regression tests pass; paper readiness gate remains separate from live.
- Performance approval requires adequately sized independent OOS tests and cost sensitivity; the current +0.59% base sample is **not sufficient**.
- Notification automation should verify each claim against a commit/run/manual compiler evidence; do not notify solely because someone changes the word "BLOCKED" to "READY".

## Links

- Experimental PR: https://github.com/sergi1978-ai/Trading/pull/14
- Fixed-hypothesis report: `docs/PHASE2_1_V11_PARITY_AND_VALIDATION.md`
- Pine: `pine/LONG_AI_PROFIT_v1_1_A_LAB.pine`
- Reconstructed stock sessions: `lib/stock-rth-rebuild.js`; tests: `test/stock-rth-rebuild.test.js`

## Latest implementation hardening

The Pine source now includes the same research warmup thresholds (70 closed daily/60 closed 4H) and a bounded stop-limit entry. This improves the declared contract but **still does not establish actual fill parity**: TradingView stop-limit order execution can differ from the JS reject-on-gap logic. Pine compile/Strategy Tester trade comparison is still a manual gate.

## User-provided TradingView evidence (2026-10-28 23:58 Madrid)

- User has run **LONG AI PROFIT v1.1 LAB | A Pullback Reclaim** in a standard **1H Coinbase BTCUSD** TradingView chart with Strategy Report period **2026-01-01 through 2026-10-28**, initial capital **10,000 USD**.
- Strategy Report shows trades and successful recalculation; this demonstrates execution/compilation in the TradingView UI and advances the previous missing-compile gate. **Not evidence of a profitable strategy or JS parity.**
- In the Trades list, rows #10 and #11 have the same entry **Oct 3 2026 at 18:00** (USD 85,000.01) but different exits (Oct 4 and Oct 5); rows #8/#9 have the same entry **Sep 27 2026 at 19:00** (USD 84,817.92) and exit at 22:00. These look consistent with partial TP1/TP2 legs, **not separate position-opening events**; interpret with the full CSV before counting actual entries.
- One tiny quantity around **0.000001 BTC** is reported on the Sept 5 position. Investigate TP order reservation, Pine exit resizing, rounding and commission rounding. Not yet proven an implementation bug.
- The user has left **Calculate on bar close** enabled; the '1' next to **Ejecución de scripts** reflects one checked setting, **not an error count**.
- Keep 4 ticks/bar default simulation setting fixed for comparison; optional higher intrabar detail should be a separate experiment.
- The download icon at the upper right of **Lista de operaciones** should export CSV in TradingView Strategy Tester even if paid chart OHLC export is unavailable. Request this CSV and the **Metrics** export to group partial exits by identical entry and reconcile Pine signals with JS by UTC timestamps.
- Evidence is from screenshots supplied to ChatGPT; screenshots have not been uploaded to this public repository.

**Immediate next gate:** CSV list of trades + key metrics for Coinbase BTCUSD 1H, and Pine-vs-JS per-entry comparison. No live/paper approval.

## No-Premium alternative: visually audit partial exits (screenshot 2026-10-29 00:03 Madrid)

The user confirmed the TradingView trade-list download is unavailable to their free subscription. **Do not require paid CSV or ask them to upgrade.** The current screenshots show:

| Entry shown by TradingView | Exit reason label | Exit date/time shown | Exit price | Per-leg shown result |
|---|---|---|---:|---:|
| Oct 3 2026 18:00, $85,000.01 | TP1 | Oct 4 21:00 | $86,007.52 | +$13.44 |
| same entry | TP2 | Oct 5 16:00 | $85,041.11 | -$0.64 |
| Sep 27 2026 19:00, $84,817.92 | TP1 | Sep 27 22:00 | $84,128.54 | -$11.33 |
| same entry | TP2 | Sep 27 22:00 | $84,128.54 | -$11.33 |
| Sep 5 2026 16:00, $79,826.47 | TP1 | Sep 6 14:00 | $79,280.77 | -$9.75 |
| same entry | TP2 | Sep 6 14:00 | $79,280.77 | -$9.75 |
| same entry | TIME_7D | Sep 12 17:00 | $77,337.94 | -$0.003 (0.000001 BTC residual) |

Prices/date/times copied visually from the screenshot (UI timezone unspecified). These are **exit legs**, not separate fresh entries. A `strategy.exit("TP1", ..., stop=..., limit=...)` order can close at the STOP, even though the ID is TP1. This explains negative PnL under TP1 and TP2; it does not by itself establish a strategy bug. Partial exit reservation and tiny residual are known concerns that warrant review, not proof of rounding error.

### Audit-only Pine variant

`pine/LONG_AI_PROFIT_v1_1_1_AUDIT.pine` is a separate candidate based on the v1.1 strategy. It changes **only the exit reason comments and adds a small trade table** for the latest 8 exit legs (UTC timestamps, actual exit reason, account-currency profit). It counts distinct entry times, allowing comparisons from screenshots without a subscription or CSV export.

**Not compiled in TradingView yet**. Before trusting the diagnostic, the user should load it as a separate script, verify compilation, and keep the original v1.1 unchanged. No strategy improvements, cash orders, live execution or risk control changes are claimed.

The measured Sep/Oct screenshot results cannot substitute for the still missing same-date-and-time **JS vs Pine** entry parity and holdout performance tests.
