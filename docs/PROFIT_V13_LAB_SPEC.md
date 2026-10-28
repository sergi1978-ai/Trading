# LONG AI PROFIT v1.3 — isolated Pine Strategy Tester LAB

**Status: EXPERIMENTAL; NOT approved for actual trading or Trading 2026 production.**
Requested for a free TradingView account on an iPad. No paid CSV chart export is needed to test the script. Compile in the Pine Editor and inspect Strategy Tester metrics and the built-in seven-leg audit table.

## Strategy structure (frozen BEFORE observing v1.3 outcomes)

Chart: standard 1H, COINBASE:BTCUSD for first parity check. 1D and 4H context are offset one bar with `barmerge.lookahead_on` to avoid using in-progress HTF candles. Never run on 4H, Heikin Ashi, Renko, or synthetic candles. Crypto is on by default; **US stocks are blocked by default** until 1H/4H RTH session alignment is separately validated.

A and B are **independent, selectable engines**. Exactly one is backtested at a time; the script must not report their combined performance as if independent uncorrelated positions had been traded.

- **A · PULLBACK**: 1D rising EMA20/EMA50, closed 4H EMA20>EMA50 with rising structure; 4H positive DI vs negative DI with ADX>=17, improving 4H MACD histogram; 4H recent low near EMA20 support, 1H dip below its EMA20 and bullish reclaim above prior 1H high. 1H RSI 51–72, positive MACD histogram and relative volume >=1.1.
- **B · BREAKOUT RETEST**: after the same confirmed multi-timeframe trend/force/momentum/volume filters, an initial 1H close breaks the previous 20-bar high on >=1.25x volume. Store that level. Wait for a subsequent 1H low near the level and a bullish close/reclaim; stop tracking after ten 1H candles or a substantial loss of the level. No instantaneous breakouts and no selling short.
- **BTC context**: read only, with selectable informational, disabled or mandatory 4H confirmation. Mandatory mode is not automatically asserted to be more profitable.
- **Volatility / price discipline**: confirmed ATR14 4H sets the maximum extension from EMA20, a 0.2 ATR stop buffer, and stop-limit max chase of 0.2 ATR. A stop wider than 10% of trigger is rejected. Proposed resistance RR>=2.0 net of a fixed 0.2% quote price cost reserve. If no overhead historical resistance, 3R is just a theoretical placeholder, NOT guaranteed upside.
- **Non-gating diagnostics**: Bollinger-band compression (1H stdev width vs its average), VWAP location, weekly context omitted because too slow for 2–7 day positions. These diagnostics intentionally do not enter the already selective buy gates.
- **Entry sizing**: minimum of 0.5% equity / expected stop distance inclusive of a cost reserve, and 25% equity notional allocation. A gap beyond stop may still exceed 0.5% realized loss: not a guaranteed risk floor.
- **Exits**: 50% at 1.5R and 50% at 3R with protective stop/limit brackets, independent labels for profit vs stop. After first partial exit cancel original TP1 and keep an updated trailing stop on actual residual. Time-exit 7 days, review/exit if insufficient advance after 3 days, close remaining notional below 1 USD. Stop-limit entries expire after three 1H bars.
- **Model limits**: Pine strategy broker emulator differs from JavaScript simulator and reality. Script config uses 0.05% commission and fixed two ticks slippage; actual spread, funding, broker fee tier and order-fills can be much worse. Pine compiler results and exact fill parity are **not** yet available via GitHub.

## Why these indicators, not every indicator?

EMA and market structure determine *regime/location*. ADX and DI gauge trend strength/direction independent of price relative to the EMA. MACD histogram slope detects momentum recovery; RSI helps reject overbought chases and weak rebounds. RVOL confirms actual participation. ATR controls stop and overextension distances. VWAP and BB compression are **information-only** until a separate hypothesis and untouched sample justify making them trade gates. Using many correlated oscillators as mandatory checks would suppress entries and amplify overfitting without demonstrating a profit edge.

## Verification sequence

1. GitHub static checks and legacy engine regressions (these DO NOT compile Pine).
2. User opens `pine/LONG_AI_PROFIT_v1_3_LAB.pine` as a NEW script, selects **COINBASE:BTCUSD 1H** and runs A and B independently with identical strategy tester dates and 10,000 USD initial capital.
3. Check Pine Editor compiler, report net return, closed position entries (group TP1/TP2 partials), profit factor, drawdown, costs, and whether dust exits persist.
4. Compare A/B signals against independent JavaScript reproduction of the **v1.3 rules** on same exchange, exact 1H/4H/1D candles and session anchors. **The existing v1.2 JS engine does NOT implement v1.3; do not claim parity.**
5. Repeat same frozen values on ETH and SOL and then equities after RTH parity, with costs and time periods held out. Do not tune on the 2024–2026 windows already seen.
6. Keep C Early Expansion out of this tradeable LAB because it lost money in prior samples; may remain a non-tradeable radar candidate.
7. A profitable Strategy Tester alone does not authorize putting v1.3 on Vercel production, entering paper-live order simulation, or trading real money. All these remain separate gates.

**Release decision: NO GO pending independent Pine compilation, fill parity, out-of-sample evidence and controlled Trading 2026 laboratory integration.**
