# LONG AI PROFIT v1.5 - C single-exit research plan

**STATUS: LAB ONLY. No verified TradingView compilation or profitability for v1.5; no Pine-to-JS fill parity.**

## Evidence motivating the test
Three unique BTCUSD continuation positions appear in the user's Oct 29 screenshots, despite 7 reported closed exit legs: May 9 2026 +$13.04, Aug 30 -$36.00 plus tiny dust, Oct 3 +$38.27; total net +$15.32 (+0.15%) from $10,000 and reported per-leg profit factor 1.426. This is far too small a sample to substantiate a trading edge.

## One change at a time: fixed comparison modes

0. Original reference: v1.4 route C CONTINUACIO (prior file), same eight-1H consolidation, D/4H context, strength score >=3/4, RSI 52–76, 1H RVOL>=1.10, 50% at 1.5R / 50% at 3R.
1. New C15 EXECUCIO: same C entrance regime but replaces separate partial exits with ONE full-position protective bracket at stop and 2.25R profit objective. No TP1/TP2 reservations, eliminates split-exit dust class; preserves 3-day no-impulse, 7-day time-out, 3-hour pending stop-limit and 8-bar cooldown. 2.25R is a theoretical target, not a profit prediction.
2. New C15 QUALITAT: exactly the same C15 execution plus ONE preregistered quality criterion: breakout bar closes within top 30% of its total high-low range AND bullish body is >=40% of total range. Thresholds are research presets, not fitted to this history. Test against C15 EXECUCIO, and record if the resulting sample becomes too small.

Other restrictions: target 0.5% account risk, 25% account nominal allocation cap; gaps can exceed that risk. Same cost reserve 0.2%. Stop-limit max chase 0.20x confirmed ATR4H. 1D and 4H use closed bars with lookahead_on and [1] offsets. Stocks fail closed without session RTH reconstruction parity.

## Specific risk / execution fixes
- Replaced full-stack TP1/TP2 with only one exit order per position to keep trade counting interpretable and remove reservation dust.
- End-of-day 60-bar resistance check does not invent room=3R when price is at new highs. The panel displays NOT IDENTIFIED; if a real resistance lies above the trigger, require >=1.5R available after cost reserve. Profit objective 2.25R remains a hypothesis.
- Does not turn on calc_on_order_fills; TradingView documents historical lookahead concerns.
- Pending protective bracket placed alongside pending entry, using signal-bar levels. Target re-anchored to actual fill after fill is known to Pine. Intrabar first fill may still differ from JS.

## Quality gates before any promotion
1. GitHub static tests are *not* TradingView compilation.
2. User compiles v1.5 on COINBASE:BTCUSD standard 1H, same 2026 dates, $10k initial capital and fees, and reports separately C15 EXECUCIO and C15 QUALITAT metrics, trade list.
3. Compare unique position counts, stop fills vs 2.25R exits, net P&L, max drawdown, profit factor and cost sensitivity, not the count of TP legs.
4. Freeze the rules before fresh ETH/SOL and forward chronological validation. Do not keep adjusting after inspecting 2026.
5. JavaScript Trading 2026 has no matched v1.5 signal/execution implementation yet; do not claim parity or deploy to production.
6. No real orders. No production merge or Vercel promotion without extra independent evidence.

References: https://www.tradingview.com/pine-script-docs/faq/strategies/ and https://www.tradingview.com/pine-script-docs/concepts/strategies/
