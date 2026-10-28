# LONG AI ASSISTANT v6.6.27 — Pine-to-radar parity contract

Reference supplied by user: Pine v6.6.27 (full source), screenshot 28 Oct 2026 22:39 Madrid local time.
TradingView chart: **COINBASE:BTCUSD**, 1H, standard candles. No account or paid CSV required.

## Exact Pine execution-time contract

- Pine only runs on chart 30m or 1H (runtime.error otherwise).
- On 1H, confirmation requires `barstate.isconfirmed`. Use the 1H bar closed at signal time; execute any backtest fill on a later bar.
- For `request.security(contextTicker, "D"/"240", expression[1], lookahead=barmerge.lookahead_on)`, use the **previous** higher-TF candle relative to the **opening of the chart 1H candle**. This is NOT the latest 4H available at the 1H candle closing time. At 03:00–04:00 UTC, the 00:00–04:00 4H candle is not visible; it first becomes eligible on the 04:00–05:00 1H candle. Official TradingView documentation endorses offset+lookahead to prevent repainting.
- The Pine 1H MACD display uses `request.security(...,"60",expression[1])` (one-bar lag), but the core confirmation `buySignal` uses the **current chart bar close**.
- In crypto, the user's `btcMode` defaults to `INFORMATIU`, so BTC context does **not** block READY; `btcMode=OBLIGATORI` does. Do not infer account-side input overrides from script defaults.
- `modeTime=AUTO`, `routeMode=TOTES DUES`, `minRR=2.0`, `targetR=2.5`, `costReserve=0.4%`, `baseBars=8`, `maxExtATR=2`, `breakRVOL=1.1`, `pullRVOL=0.8` are SOURCE defaults, not necessarily active chart inputs.

## Exact default LONG entry gates from supplied source

Common:
`historyOK && dailyOK && trend4OK && btcOK && liquidOK && extensionOK && sessionOK`.
- `dailyOK`: last PREVIOUS completed daily close > previous EMA50, EMA50 >= prior EMA50.
- `trend4OK`: previous 4H close > previous EMA50 4H and EMA20 4H > EMA50 4H.
- `liquidOK`: 20-day previous SMA(close*volume) >= 1,000,000 quote currency units.
- `extensionOK`: current 1H close <= previous 4H EMA20 + 2 * previous 4H ATR14.
- `rvol`: current confirmed chart-bar volume / SMA(volume,20) **on the previous 20 chart bars**. `rvol` and dollar turnover are NOT exchange-independent.

Breakout:
`baseOK && close > breakTrigger && close[1] <= breakTrigger && close>open && rvol>=1.1 && bsValid`.
- `breakTrigger` = previous 4H highest(high,8) + syminfo.mintick.
- `breakStop` = previous 4H lowest(low,6) - 0.2 * previous 4H ATR14.
- `bsValid` = **close-priced** f_plan(close,breakStop): RR >= 2 net including 0.4% costs; min tick, stop <= 10%, ceiling check.

Pullback:
`pullLocation && close > pullTrigger && close>open && rvol>=0.8 && psValid`.
- `pullTrigger` = max(high[1] + tick, previous 4H EMA20).
- `pullLocation` uses lowest(low,3) of **chart** bars and previous 4H EMA20/EMA50 with ATR offsets.
- `pullStop` = min(previous 4H lowest(low,3), current chart lowest(low,3)) - 0.2 * ATR14 4H.
- `psValid` is f_plan(current 1H close, pullStop), NOT the pending trigger plan.
- `breakReady` and `pullReady` are prospective plans, separate from `buyBreak` and `buyPull`. A pending plan is NOT an executed or even confirmed order.

The early/explosive scores and momentum/weekly MACD are **diagnostic**, not ready-entry confirmations; do not interpret score 75/100 as 75% win probability.

## Existing api/scan.js mismatches discovered

1. The previous approximate `emaPine` seeds with the SMA of the first 20/50 points rather than Pine `ta.ema`'s first non-na observation. This can move levels, especially with short histories.
2. Approximate Pine pullback stop uses only current 1H lowest(low,3), omitting the previous 4H lowest(low,3).
3. `pineConfirmedRoute` additionally demands `pineBreakReady` / `pinePullReady` (pending-trigger f_plan), whereas Pine's current CLOSE-triggered `buyBreak/buyPull` checks `bsValid/psValid`. This can produce false discrepancies.
4. The scanner's approximate `pinePlan` omits the ceiling check of the source f_plan.
5. Native Alpaca/IEX 1H and 4H candle windows and volume do not match Coinbase candle source; direct Pine status parity cannot be asserted from Alpaca.
6. Some momentum diagnostics calculate RSI via a trailing SMA of 14 price changes rather than Pine's Wilder-smoothed `ta.rsi`; diagnostic differences may persist even with identical candles.

## Experimental implementation

`lib/pine-v6627-parity.js`:
- a pure **core** Pine entry gate reference (not the complete visual state machine)
- `pineEma()`, `pineAtr()`, `pineV6627Core()`
- time anchoring at chart 1H **bar opening**
- separate CLOSE-confirmed buyBreak/buyPull and pending-plan breakReady/pullReady
- no market execution, no alert sending, no Vercel deployment.

`test/pine-v6627-parity.test.js`: synthetic clock-boundary, EMA/ATR, incomplete history and future-data checks. Tests are NOT proof of exact parity against TradingView Pine outputs.

## Screenshot reference reading

Screenshot dated 28 October 2026, BTCUSD Coinbase 1H, Pine v6.6.27:
- `EXP · PROP RUPTURA`
- `QUALITAT ENTRADA 55/100 | NO CONFIRMADA`
- `POTENCIAL 75/100 | VIGILANCIA`
- `BENEFICI/RISC 1.9R | min 2R`
- `PLA: SENSE PLA EXECUTABLE`

**Decision: do not treat this as READY.** Do not buy on this evidence alone.

## Next independent verification

- Obtain actual historical Coinbase BTC-USD **1H and 1D** candles and build 4H from the 1H feed (Coinbase Exchange REST does not offer 4H native).
- Compare timestamp anchors and values with user screenshots and (if available) TradingView Pine display at exact selected closed bars; trading chart may use a distinct Coinbase source/revision.
- Load sufficient warmup for EMA50 4H and daily 60-day highs; reproducibly log input feed, symbol, session, timezone, provider and indicator version.
- Keep this isolated until tests are green and empirical Coinbase/Pine indicator parity is documented.
