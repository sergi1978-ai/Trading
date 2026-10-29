# LONG AI PROFIT — Fase 1: reconstrucció de dades històriques Binance Spot

**Estat**: Ingesta i consistència, no backtest de LONG AI. Cap entrada, ordre, acció de broker, merge ni desplegament de producció.

## Comprovació feta en directe via connector (29/10/2026)

En una mostra *coneguda*, del 2026-07-01 00:00Z al 2026-08-11 15:00Z, el connector Binance ha retornat, per a cadascun de BTCUSDT, ETHUSDT i SOLUSDT:
- 1.000 espelmes d'1H amb OHLC, volum i timestamps vàlids.
- 250 agregats complets de 4H coincidents amb les 250 espelmes 4H natives, **0 discrepàncies**.
- 41 agregats complets d'1D coincidents amb les 41 espelmes 1D natives, **0 discrepàncies**.
- Cap gap, duplicat ni espelma OHLC il·legal en els tres conjunts consultats; la diferència de volum era únicament d'arrodoniment de coma flotant (<1e-14 relatiu).

Aquest resultat **només comprova integritat de dades**. No avala l'estratègia, cap profit factor, ni paritat amb Coinbase/TradingView.

## Pipeline reproduïble

Fitxers:
- `lib/profit-ohlcv.mjs`: conversió, rang de dates UTC, diagnòstic de discontinuïtats i comparació d'OHLCV 4H/1D.
- `scripts/profit-binance-ohlcv.mjs`: paginació de les APIs públiques Binance Spot (sense credencials), agregació, contrast amb veles Binance natives i exportació de CSV.
- `test/profit-ohlcv.test.mjs`: regressions sintètiques de gaps, alineació horària, agregació i divergències.
- `.github/workflows/profit-ohlcv-data.yml`: una tasca de GitHub Actions recull BTCUSDT, ETHUSDT, SOLUSDT de 2025-01-01 fins a 2026-10-29 (extrem exclusiu) i publica un artefacte descarregable amb 9 CSV i `manifest.json`, **només quan l'accés públic a Binance funciona**. Si falla l'API o hi ha divergències, el job ha de fallar.

Execució en entorn Node 22:

```bash
node --test test/profit-ohlcv.test.mjs
node scripts/profit-binance-ohlcv.mjs --from=2025-01-01 --to=2026-10-29 --symbols=BTCUSDT,ETHUSDT,SOLUSDT --out=artifacts/profit-ohlcv
```

El CSV té `time,open,high,low,close,volume`, amb el temps de **OBERTURA** UTC. **L'última barra no tancada s'exclou** mitjançant límit de data històric; no es reomplen buits silenciosament.

## Per què no comparem encara els senyals Pine?

Les proves anteriors de LONG AI C es van fer amb `COINBASE:BTCUSD` a TradingView. Les noves sèries són `BINANCE:BTCUSDT`. Són exchanges i actius cotitzats diferents (USD vs USDT); una divergència de preu, espelma, volum o executats no és per si sola un error de codi.

**Fase 2 següent** (encara no implementada aquí): congelar el Pine v1.4 C i v1.5 C15, programar-ne una rèplica independent en JS utilitzant exclusivament barres 1H/4H/1D tancades, provar amb **BINANCE:BTCUSDT 1H** a TradingView, comparar barra a barra els setups i stop-limit/TP/stops, i després fer el backtest de BTC/ETH/SOL agrupant els exits per POSICIÓ. Cap implementació actual declara paritat v1.4/v1.5.

## Mostra de recerca vs test desconegut

Ja s'han inspeccionat resultats de 2024, 2025 i especialment 2026 en aquest projecte. Així, **cap d'aquestes dates és una prova genuïnament no vista** encara que es subdivideixi cronològicament. Les fem servir per reconstruir, verificar i diagnosticar; l'evidència prospectiva només es pot acumular a partir de dades futures no utilitzades per canviar regles. Si es fa un holdout històric, cal etiquetar-lo com "validació històrica contaminada per inspecció prèvia", no "blind OOS".

## Ús dels altres connectors

- CoinMarketCap proporciona context de mercat, capitalització i liquiditat quan el timestamp és verificable. **No s'insereixen snapshots actuals retrospectivament** com a filtre d'entrades 2025/2026.
- TradingCursor és una lectura externa de context i no una etiqueta d'entrada o probabilitat estadística; l'anàlisi consultada de BTC 4H incloïa contradiccions internes a alguns suports/resistències.
- Accions: no s'han introduït en aquesta ingesta. Cal un proveïdor d'accions que tingui sessions RTH/extended i preus ajustats; no intentar simular accions amb Binance.

## Criteris de la fase 2

N operacions per posició (no cames TP1/TP2), rendiment net amb fees, profit factor, màxim drawdown, R neta, comparació contra buy-and-hold, i escenaris de costos dobles / slippage i empitjorament de fills. Risc objectiu 0,5% del capital, max 25% nominal, horitzó 2–7 dies. No fer retuning de paràmetres després de mirar els resultats sense reiniciar el protocol.

Font del protocol: guia aportada "Tu estrategia con IA, en 7 prompts", TradingLab, pàgines 5, 14–19.
