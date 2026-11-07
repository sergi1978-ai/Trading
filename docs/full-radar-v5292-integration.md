# Full Radar × LONG AI SWING v5.29.2 — integration workstream

Status: **IN PROGRESS — no production changes**.

## Target
Preserve the existing full Radar UI (Radar, Altcoins, Descobrir, Learning Lab, saved lists and backups). Implement an **experimental** v5.29.2 calculation path rather than changing a version label or replacing the UI with the simplified radar.

## Current verified code state
- main/index.html is the full existing interface.
- main/api/scan.js uses the independent legacy stock scanner.
- feature/pine-v5291-parity has api/_pine5291.js, plus modified stock/crypto endpoints. It is an **unvalidated v5.29.1 approximation**, not v5.29.2.
- The TradingView v5.29.2 Pine discussed in chat is not yet in the repository as a canonical source. Its exit/backtest mechanics also require validation.
- Alpaca has returned HTTP 401 in preview. Do not treat stock results as verified until fixed.

## Acceptance criteria before any merge
1. Capture the complete canonical v5.29.2 Pine source and document exact READY A/B rules, score components, closed-bar timing, stop/TP behavior and active-position extra signals.
2. Implement a separate JS v5.29.2 engine with unit tests; no lookahead or partially formed 1D/4H candles.
3. Keep legacy stock and crypto paths intact; expose a **user-selectable experimental mode** only after the new engine passes fixtures.
4. For every ticker, show feed/source, candle timestamps, missing-data reason, A/B score, READY/WAIT, entry/stop/TP and signal explanation.
5. Run parity fixtures for stock and crypto across 1D/4H/1H with TradingView screenshots/exported bars, including signals while positions remain open and pyramiding=0.
6. Test full Radar navigation, list persistence/import/export, Discover and Learning Lab; do not silently regress any existing features.
7. Validate preview and runtime logs; obtain explicit approval before promotion to production.

## Deployment policy
Use feature/full-radar-pine-v5292 for implementation, preview first. Do not merge into main or promote without parity tests and user review.
