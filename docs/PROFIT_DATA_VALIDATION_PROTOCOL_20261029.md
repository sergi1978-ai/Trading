# LONG AI PROFIT · Protocol de recerca amb Binance, CMC i TradingCursor
Data: 2026-10-29 | ESTAT: LAB / NO LIVE

## Origen metodològic
Document aportat per l'usuari: "Tu estrategia con IA, en 7 prompts" (TradingLab), 21 pàgines. No es publica el PDF al repositori.
Pàg. 4: modificar una sola regla després de fallar la prova d'estrès.
Pàg. 5: les dades CSV de BTC 1D, 1H i 5m són fitxers SEPARATS del PDF; no estan adjunts al PDF rebut. Per tant, cal obtenir OHLCV de Binance o rebre els CSV.
Pàg. 8-9: regles objectives, simplicitat; el consell "màxim dos indicadors" és una heurística educativa, no una regla estadística universal.
Pàg. 10-13: Pine strategy, mida per risc, costos, stop i TP predefinits, codi que no repinta i revisió de cinc ordres reals.
Pàg. 14-15: mostra >=30 posicions independents per a una primera lectura, >=100 per a més credibilitat; avaluar RR real, drawdown, guany/pèrdua mitjana, expectancy neta.
Pàg. 16-17: validació fora de mostra, sensibilitat ±10/20%, costos dobles, excloure millors 5%, simulació de 1.000 recorreguts; no inventar resultats.
Pàg. 18-20: demo amb 20 operacions i seguiment del pla (18/20), sense autorització automàtica per a diners reals.

## Fonts connectades: confirmades 29/10/2026
- Binance Spot: GET BTCUSDT klines 1H verificat. Exemple de prova: 1.000 barres des de 2026-07-01T00:00Z fins a 2026-08-11T15:00Z; exchangeInfo BTCUSDT verificat. Ingesta futura: paginació per timestamp, descartar última barra no tancada, detectar gaps sense imputar, deduplicar per openTime, timezone UTC, registrar hash/proveïdor/quotes.
- CoinMarketCap: get_crypto_quotes_latest BTC/ETH/SOL i get_crypto_technical_analysis BTC verificats. Ús: univers, capitalització, rang, liquiditat/momentum context. Dades de snapshot actual NO s'han d'introduir retrospectivament en un backtest del 2025/2026 (lookahead). Els seus indicadors no són 1H/4H variables amb període lliure.
- TradingCursor: request_analysis("BINANCE","BTCUSDT","4h") retornà anàlisi de 29/10/2026. Ús: segona opinió qualitativa, mai com a true label, probabilitat calibrada o execució. El retorn contenia nivells de resistència/suport interns inconsistents; no confiar-hi sense recalcular a partir d'OHLCV.
- Accions: no cobertes per aquests OHLCV Binance Spot; continuar amb Alpaca/proveïdor d'accions amb sessions RTH/extended i ajustos corporatius verificats.

## Pla de validació preregistrat
1. Conservar originals A/B/C v1.4 i C15 v1.5 SENSE retocs per a comparació. L'usuari va reportar pèrdues noves a v1.5, sense mètriques adjuntes; NO GO per a producció.
2. Recollir OHLCV BTCUSDT, ETHUSDT, SOLUSDT a Binance Spot en 1H amb prou històric. Reconstruir 4H i 1D amb fronteres UTC, també descarregar 4H/1D independents per fer checksum de consolidacions. Documentar no-alineació amb COINBASE:BTCUSD: mai exigir paritat de preus a dos exchanges diferents.
3. Auditar paritat barra per barra entre Pine en BINANCE:BTCUSDT 1H i motor local: context 1D/4H tancat, EMA/ATR/RSI/volum, timestamp del setup, activació stop-limit, cancel·lació, stop, sortida, comissions i horitzó 2-7 dies. Tancar falsejats per doble comptatge TP1/TP2 i residus.
4. Usar dates de calibratge establertes per endavant i deixar temporalment fora una finestra recent no consultada per modificar regles. Els resultats de 2026 JA inspeccionats en aquest xat no són una prova independent no vista. Si no hi ha mostres genuïnament noves, marcar "sense OOS vàlid" i recórrer a paper-forward.
5. Comparar estratègies separades A/B/C, buy-and-hold de BTC com a referència (sense considerar-lo swing), i un control simple no complex; NO agrupar els beneficis de motors si compartien capital.
6. Informar per POSICIÓ independent, a més de sortides parcials: n, net P&L USD/% i R net, profit factor, win rate, guany/pèrdua mitjans, drawdown, exposició, max adverse/favorable excursion, durada i cost real en EUR/USD segons compte.
7. Estrès: costos x2; slippage x2; barra ambigu stop/TP -> stop primer; sensibilitat de paràmetres un a un ±10/20% SENSE seleccionar el millor; excloure el top 5% de guanys; bootstrap blocs o resampling de trades amb advertiment d'independència, 1.000 simulacions; repetició per règim/actiu, no forçar resultats.
8. Predefinir criteris no-GO: menys de 30 entrades INDEPENDENTS en holdout, profit factor net <=1, retorn negatiu amb costos doblats, divergència de fills Pine/JS, risc >0,5% abans de gaps, o aportació dominant d'una única operació; la suficiència estadística pot requerir molt més de 30.
9. Només si la mostra i OOS superen els criteris: laboratori de Trading 2026 i paper trading assistit, sense execució real automàtica; actualitzar amb evidència independent.

## Què NO és un resultat de backtest
Les cotitzacions puntuals de CMC, els 1.000 bars recuperats avui i l'anàlisi IA de TradingCursor només DEMOSTREN DISPONIBILITAT DE DADES. Aquest document NO inclou cap backtest reproduït, cap profit factor nou ni cap avantatge estadístic demostrat.

## Referències al codi
- pine/LONG_AI_PROFIT_v1_4_LAB.pine
- pine/LONG_AI_PROFIT_v1_5_C_LAB.pine
- pine/LONG_AI_PROFIT_v1_5_C_DIAGNOSTIC_NO_RETUNE.pine
- docs/PROFIT_V15_RESEARCH_PLAN.md
