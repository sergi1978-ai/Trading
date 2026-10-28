# LONG AI PROFIT v1.1 — Readiness / release gates

Status as of **2026-10-28**: **BLOCKED · LAB ONLY**. User has requested notification once ready to apply on Pine and Trading 2026. Do not merge or promote automatically.

| Gate | Current evidence | Status |
|---|---|---|
| JavaScript unit/regression tests | 57/57 PASS on 2026-10-28 (before RTH suite); CI must remain green after all changes | PASS provisional |
| Six crypto symbols and frozen historical replay | 2025-03–09, 6 accepted Coinbase pairs; 23 closed A v1.1 trades | PASS for historical feasibility only |
| Robust net expected return | v1.1 PF 1.1066 (required >=1.2), mean R -0.0045, cost 10bps each side return -0.2159%, 23 trades | **FAIL** |
| Fully out-of-sample / walk-forward | No >=100 OOS closed trades; 2025 results have now been inspected | **MISSING** |
| Pine compiled inside TradingView and order list reviewed | Pine v1.1 file present, compiler/emulator output not available in GitHub connector | **MISSING** |
| Pine↔JavaScript same-source signal-by-signal parity | No timestamped list of Pine v1.1 signals compared with JS on same Coinbase bars | **MISSING** |
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
